import { getUser, refreshSession } from '@netlify/identity';
import {
  MAX_GALLERY_PHOTOS,
  slugify,
  validateEventDraft,
  type DraftErrors,
  type EventDraftInput,
} from '../lib/event-draft.ts';
import { PhotoError, formatBytes, preparePhoto, type PreparedPhoto } from './photo-prep';

/** Browser logic for /admin/drafts/event/. All user text is written with textContent. */

const STORAGE_KEY = 'bcec-event-draft-v1';
const ADMIN_ROLE = 'admin';

type Photo = { prepared: PreparedPhoto; alt: string; credit: string };
type SavedDraft = { input: Partial<EventDraftInput>; slugEdited: boolean };
type DraftResult = { prUrl: string | null; previewUrl: string | null };

class DraftRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: DraftErrors,
  ) {
    super(message);
  }
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector)!;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function initEventDrafter({ demo }: { demo: boolean }) {
  const form = $<HTMLFormElement>('#event-form');
  const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement = HTMLInputElement>(name: string) =>
    form.elements.namedItem(name) as T;
  const statsRows = $('#stats-rows');
  const statTemplate = $<HTMLTemplateElement>('#stat-row-template');
  const coverItem = $('#cover-item');
  const galleryList = $('#gallery-list');
  const photoStatus = $('#photo-status');
  const status = $('#drafter-status');
  const submitButton = $<HTMLButtonElement>('#submit-draft');
  const progress = $('#submit-progress');
  const result = $('#submit-result');
  const errorSummary = $('#error-summary');

  let cover: Photo | null = null;
  const gallery: Photo[] = [];
  let slugEdited = false;
  let busy = false;
  let saveTimer = 0;

  // ── Collecting and restoring form values ───────────────────────

  const checkedValues = (name: string) =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((input) => input.value);

  const collectInput = (): EventDraftInput => ({
    title: field('title').value,
    slug: field('slug').value,
    categories: checkedValues('categories'),
    date: field('date').value,
    startTime: field('startTime').value,
    endTime: field('endTime').value,
    location: field('location').value,
    summary: field('summary').value,
    registerUrl: field('registerUrl').value,
    project: field<HTMLSelectElement>('project').value,
    impact: field('impact').value,
    raised: field('raised').value,
    stats: [...statsRows.querySelectorAll('[data-stat-row]')].map((row) => ({
      label: $<HTMLInputElement>('[name="stat-label"]', row).value,
      value: $<HTMLInputElement>('[name="stat-value"]', row).value,
      metric: $<HTMLSelectElement>('[name="stat-metric"]', row).value,
    })),
    outcomes: field<HTMLTextAreaElement>('outcomes').value.split('\n'),
    partners: checkedValues('partners').map((org) => ({
      org,
      role: (form.elements.namedItem(`role-${org}`) as HTMLSelectElement | null)?.value ?? '',
    })),
    cover: cover ? { alt: cover.alt, credit: cover.credit } : null,
    gallery: gallery.map((photo) => ({ alt: photo.alt })),
    body: field<HTMLTextAreaElement>('body').value,
    sourceNote: field<HTMLTextAreaElement>('sourceNote').value,
  });

  const addStatRow = (stat?: { label?: string; value?: string; metric?: string }) => {
    const row = (statTemplate.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
    $<HTMLInputElement>('[name="stat-label"]', row).value = stat?.label ?? '';
    $<HTMLInputElement>('[name="stat-value"]', row).value = stat?.value ?? '';
    $<HTMLSelectElement>('[name="stat-metric"]', row).value = stat?.metric ?? '';
    statsRows.append(row);
    return row;
  };

  const syncPartnerRoles = () => {
    form.querySelectorAll<HTMLElement>('[data-partner]').forEach((wrapper) => {
      const checked = $<HTMLInputElement>('input[name="partners"]', wrapper).checked;
      $('[data-partner-role]', wrapper).hidden = !checked;
    });
  };

  const restore = (saved: SavedDraft) => {
    const { input } = saved;
    const simple = ['title', 'slug', 'date', 'startTime', 'endTime', 'location', 'summary', 'registerUrl', 'project', 'impact', 'raised', 'body', 'sourceNote'] as const;
    for (const name of simple) {
      const value = input[name];
      if (typeof value === 'string') field(name).value = value;
    }
    form.querySelectorAll<HTMLInputElement>('input[name="categories"]').forEach((box) => {
      box.checked = Boolean(input.categories?.includes(box.value));
    });
    field<HTMLTextAreaElement>('outcomes').value = (input.outcomes ?? []).join('\n').trim();
    statsRows.replaceChildren();
    (input.stats ?? []).filter((stat) => stat.label || stat.value).forEach((stat) => addStatRow(stat));
    form.querySelectorAll<HTMLInputElement>('input[name="partners"]').forEach((box) => {
      const partner = input.partners?.find((item) => item.org === box.value);
      box.checked = Boolean(partner);
      const role = form.elements.namedItem(`role-${box.value}`) as HTMLSelectElement | null;
      if (role) role.value = partner?.role ?? '';
    });
    slugEdited = saved.slugEdited;
    syncPartnerRoles();
  };

  const writeSaved = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ input: collectInput(), slugEdited } satisfies SavedDraft));
    } catch {
      // Saving is a convenience only.
    }
  };

  let savePending = false;
  const save = () => {
    window.clearTimeout(saveTimer);
    savePending = true;
    saveTimer = window.setTimeout(() => {
      savePending = false;
      writeSaved();
    }, 400);
  };

  const clearSaved = () => {
    window.clearTimeout(saveTimer);
    savePending = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  // Timers are throttled in hidden tabs, so flush any pending save straight away.
  const flushSave = () => {
    if (!savePending) return;
    window.clearTimeout(saveTimer);
    savePending = false;
    writeSaved();
  };
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });

  // ── Photos ─────────────────────────────────────────────────────

  const photoCard = (photo: Photo, options: { label: string; withCredit: boolean; onRemove: () => void }) => {
    const card = el('div', 'grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[10rem_minmax(0,1fr)]');
    const image = el('img', 'aspect-[4/3] w-full rounded-md bg-surface object-cover');
    image.src = photo.prepared.previewUrl;
    image.alt = '';
    const details = el('div', 'min-w-0 space-y-2');
    const { width, height, originalWidth, originalHeight, blob } = photo.prepared;
    const sizeNote =
      originalWidth > width ? ` (from ${originalWidth} × ${originalHeight})` : ' (original size kept)';
    details.append(el('p', 'text-sm text-muted', `Website copy: ${width} × ${height} px, ${formatBytes(blob.size)}${sizeNote}`));
    if (photo.prepared.warning) details.append(el('p', 'rounded-md bg-amber-50 p-2 text-sm text-amber-900', photo.prepared.warning));
    if (options.withCredit && height > width) {
      details.append(
        el('p', 'rounded-md bg-amber-50 p-2 text-sm text-amber-900', 'This is a portrait photo. The cover is shown as a wide landscape strip, so the top and bottom will be cut off. A landscape photo will look better.'),
      );
    }

    const altLabel = el('label', 'block text-sm font-semibold text-ink', `Describe ${options.label}`);
    const alt = el('input', 'draft-input');
    alt.type = 'text';
    alt.maxLength = 200;
    alt.value = photo.alt;
    alt.placeholder = 'e.g. Volunteers planting seedlings along the river';
    alt.addEventListener('input', () => {
      photo.alt = alt.value;
      renderPreview();
    });
    altLabel.append(alt);
    details.append(altLabel, el('p', 'text-xs text-muted', 'Read aloud by screen readers. Describe what’s in the photo.'));

    if (options.withCredit) {
      const creditLabel = el('label', 'block text-sm font-semibold text-ink', 'Photo credit (optional)');
      const credit = el('input', 'draft-input');
      credit.type = 'text';
      credit.maxLength = 120;
      credit.value = photo.credit;
      credit.placeholder = 'e.g. Photo: Jane Smith';
      credit.addEventListener('input', () => {
        photo.credit = credit.value;
      });
      creditLabel.append(credit);
      details.append(creditLabel);
    }

    const error = el('p', 'field-error');
    error.hidden = true;
    error.dataset.photoError = '';
    const remove = el('button', 'draft-link', 'Remove photo');
    remove.type = 'button';
    remove.dataset.photoRemove = '';
    remove.disabled = busy;
    remove.addEventListener('click', () => {
      if (!busy) options.onRemove();
    });
    details.append(error, remove);
    card.append(image, details);
    return card;
  };

  const renderCover = () => {
    coverItem.replaceChildren();
    if (!cover) return;
    coverItem.append(
      photoCard(cover, {
        label: 'the cover photo',
        withCredit: true,
        onRemove: () => {
          if (cover) URL.revokeObjectURL(cover.prepared.previewUrl);
          cover = null;
          renderCover();
          renderPreview();
        },
      }),
    );
  };

  const renderGallery = () => {
    galleryList.replaceChildren(
      ...gallery.map((photo, index) => {
        const item = el('li');
        item.append(
          photoCard(photo, {
            label: `photo ${index + 1}`,
            withCredit: false,
            onRemove: () => {
              URL.revokeObjectURL(photo.prepared.previewUrl);
              gallery.splice(gallery.indexOf(photo), 1);
              renderGallery();
            },
          }),
        );
        return item;
      }),
    );
  };

  const prepare = async (file: File, problems: string[]) => {
    try {
      return await preparePhoto(file);
    } catch (error) {
      problems.push(error instanceof PhotoError ? `${file.name}: ${error.message}` : `${file.name} couldn’t be prepared.`);
      return null;
    }
  };

  $<HTMLInputElement>('#cover-file').addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    photoStatus.textContent = 'Preparing the cover photo…';
    const problems: string[] = [];
    const prepared = await prepare(file, problems);
    if (!prepared) {
      photoStatus.textContent = problems.join(' ');
      return;
    }
    if (cover) URL.revokeObjectURL(cover.prepared.previewUrl);
    cover = { prepared, alt: cover?.alt ?? '', credit: cover?.credit ?? '' };
    photoStatus.textContent = 'Cover photo ready.';
    renderCover();
    renderPreview();
  });

  $<HTMLInputElement>('#gallery-files').addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    const space = Math.max(0, MAX_GALLERY_PHOTOS - gallery.length);
    const problems: string[] = [];
    if (files.length > space) problems.push(`Only ${MAX_GALLERY_PHOTOS} extra photos can be added, so ${files.length - space} were skipped.`);
    const accepted = files.slice(0, space);
    for (const [index, file] of accepted.entries()) {
      photoStatus.textContent = `Preparing photo ${index + 1} of ${accepted.length}…`;
      const prepared = await prepare(file, problems);
      if (prepared) {
        gallery.push({ prepared, alt: '', credit: '' });
        renderGallery();
      }
    }
    photoStatus.textContent = problems.length ? problems.join(' ') : 'Photos ready.';
  });

  // ── Preview ────────────────────────────────────────────────────

  const formatTime = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return '';
    const hours = Number(match[1]);
    return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'am' : 'pm'}`;
  };

  const renderPreview = () => {
    const input = collectInput();
    const preview = $('#event-preview');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T12:00:00Z`) : null;
    const article = el('article', 'flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-5');
    const badge = el('div', 'w-fit shrink-0 rounded-lg bg-brand-light px-4 py-2 text-center text-brand-dark');
    badge.append(
      el('div', 'font-heading text-2xl font-bold leading-none', date ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', timeZone: 'UTC' }).format(date) : '–'),
      el('div', 'text-xs font-semibold uppercase', date ? new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' }).format(date) : 'Date'),
    );
    const body = el('div', 'min-w-0 flex-1');
    const when = [
      date ? new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : 'Date to be added',
      [formatTime(input.startTime), formatTime(input.endTime ?? '')].filter(Boolean).join(' – ') || 'Time to be added',
      input.location.trim() || 'Location to be added',
    ].join(' · ');
    body.append(
      el('h3', 'font-heading text-lg font-bold text-brand-dark wrap-anywhere', input.title.trim() || 'Event name'),
      el('p', 'mt-0.5 text-sm text-muted', when),
      el('p', 'mt-2 text-sm text-muted', input.summary.trim() || 'Your summary will appear here.'),
    );
    article.append(badge, body);
    if (input.registerUrl?.trim()) {
      article.append(el('span', 'inline-flex w-fit shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white', 'Register'));
    }
    const nodes: HTMLElement[] = [article];
    if (cover) {
      const image = el('img', 'mt-4 aspect-video w-full rounded-xl object-cover');
      image.src = cover.prepared.previewUrl;
      image.alt = cover.alt;
      nodes.push(image);
    }
    preview.replaceChildren(...nodes);
    $('#summary-count').textContent = String(input.summary.length);
  };

  // ── Errors ─────────────────────────────────────────────────────

  const fieldIdFor = (key: string) =>
    ({ categories: 'categories-group', coverAlt: 'cover-file', gallery: 'gallery-files' })[key] ?? key;

  const clearErrors = () => {
    errorSummary.hidden = true;
    form.querySelectorAll<HTMLElement>('.field-error').forEach((error) => {
      error.hidden = true;
      error.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
  };

  const showErrors = (errors: DraftErrors) => {
    clearErrors();
    const list = $('#error-list');
    list.replaceChildren();
    const statRows = [...statsRows.querySelectorAll<HTMLElement>('[data-stat-row]')];
    const galleryErrors = [...galleryList.querySelectorAll<HTMLElement>('[data-photo-error]')];
    for (const [key, message] of Object.entries(errors)) {
      let target: HTMLElement | null = form.querySelector<HTMLElement>(`[data-error-for="${key}"]`);
      const [group, index] = key.split('.');
      if (group === 'stats') target = statRows[Number(index)]?.querySelector<HTMLElement>('[data-stat-error]') ?? null;
      if (group === 'gallery' && index !== undefined) target = galleryErrors[Number(index)] ?? null;
      if (key === 'coverAlt') target = coverItem.querySelector<HTMLElement>('[data-photo-error]') ?? target;
      if (group === 'partners') target = null;
      if (target) {
        target.textContent = message;
        target.hidden = false;
      }
      const input = form.elements.namedItem(key);
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', 'true');
      if (group === 'stats' || group === 'partners') $('#after-event').setAttribute('open', '');

      const item = el('li');
      const link = el('a', 'underline underline-offset-2', message);
      link.href = `#${fieldIdFor(group === 'stats' ? 'add-stat' : group === 'gallery' ? 'gallery' : group === 'partners' ? 'after-event' : key)}`;
      item.append(link);
      list.append(item);
    }
    errorSummary.hidden = false;
    errorSummary.focus();
  };

  // ── Submitting ─────────────────────────────────────────────────

  const step = (message: string) => {
    progress.append(el('li', '', message));
  };

  const api = async (action: string, init: RequestInit) => {
    const response = await fetch(`/api/admin/drafts/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      ...init,
      headers: { 'X-BCEC-Admin': '1', ...(init.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new DraftRequestError(data.error ?? 'Something went wrong.', response.status, data.errors);
    return data;
  };

  const submitDraft = async (input: EventDraftInput, slug: string, photos: { cover: Photo | null; gallery: Photo[] }): Promise<DraftResult> => {
    if (demo) {
      for (const message of ['Creating your draft…', ...(photos.cover ? ['Uploading the cover photo…'] : []), ...photos.gallery.map((_, i) => `Uploading photo ${i + 1} of ${photos.gallery.length}…`), 'Opening it for review…']) {
        step(message);
        await sleep(300);
      }
      return { prUrl: '#demo-review', previewUrl: '#demo-preview' };
    }

    await refreshSession().catch(() => null);
    step('Creating your draft…');
    const { branch } = await api('start', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
    const upload = (photo: Photo, which: string) =>
      api(`photo?${new URLSearchParams({ branch, slug, photo: which })}`, {
        headers: { 'Content-Type': 'image/jpeg' },
        body: photo.prepared.blob,
      });
    if (photos.cover) {
      step('Uploading the cover photo…');
      await upload(photos.cover, 'cover');
    }
    for (const [index, photo] of photos.gallery.entries()) {
      step(`Uploading photo ${index + 1} of ${photos.gallery.length}…`);
      await upload(photo, String(index + 1));
    }
    step('Opening it for review…');
    return api('finish', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch, draft: input }) });
  };

  const setBusy = (value: boolean) => {
    busy = value;
    submitButton.disabled = value;
    submitButton.textContent = value ? 'Sending…' : 'Send for review';
    // Photos are locked while sending so uploads always match their descriptions.
    form
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('#cover-file, #gallery-files, #clear-draft, [data-photo-remove]')
      .forEach((control) => {
        control.disabled = value;
      });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    result.hidden = true;
    progress.replaceChildren();
    // Snapshot photos and their descriptions together so they can't drift apart mid-upload.
    const photos = { cover, gallery: [...gallery] };
    const input = collectInput();
    const { draft, errors } = validateEventDraft(input);
    if (!draft) {
      showErrors(errors);
      return;
    }
    clearErrors();
    setBusy(true);
    try {
      const outcome = await submitDraft(input, draft.slug, photos);
      step('Done.');
      const pr = $<HTMLAnchorElement>('#result-pr');
      pr.href = outcome.prUrl ?? '#';
      const preview = $<HTMLAnchorElement>('#result-preview');
      preview.hidden = !outcome.previewUrl;
      if (outcome.previewUrl) preview.href = outcome.previewUrl;
      result.hidden = false;
      result.focus();
      clearSaved();
    } catch (error) {
      if (error instanceof DraftRequestError) {
        if (error.errors) showErrors(error.errors);
        else if (error.status === 409) showErrors({ slug: error.message });
        else if (error.status === 401) {
          step('Your session has ended. Sign in again in a new tab, then send again; your answers are saved here.');
        } else step(error.message);
      } else {
        step('Something went wrong. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  });

  // ── Wiring ─────────────────────────────────────────────────────

  const updateSlug = () => {
    if (!slugEdited) field('slug').value = slugify(field('title').value, field('date').value);
  };

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target === field('title') || target === field('date')) updateSlug();
    if (target === field('slug')) {
      const slug = field('slug');
      slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      slugEdited = slug.value !== '';
      if (!slugEdited) updateSlug();
    }
    if (target instanceof HTMLInputElement && target.name === 'partners') syncPartnerRoles();
    if (target instanceof HTMLSelectElement && target.name === 'stat-metric') {
      const row = target.closest('[data-stat-row]');
      const label = row?.querySelector<HTMLInputElement>('[name="stat-label"]');
      if (label && !label.value && target.value) label.value = target.selectedOptions[0]?.textContent ?? '';
    }
    renderPreview();
    save();
  });
  form.addEventListener('change', () => {
    syncPartnerRoles();
    save();
  });

  $('#add-stat').addEventListener('click', () => {
    $<HTMLInputElement>('[name="stat-label"]', addStatRow()).focus();
    save();
  });
  statsRows.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('[data-remove-stat]');
    if (!button) return;
    button.closest('[data-stat-row]')?.remove();
    save();
  });

  const resetForm = () => {
    form.reset();
    statsRows.replaceChildren();
    if (cover) URL.revokeObjectURL(cover.prepared.previewUrl);
    gallery.forEach((photo) => URL.revokeObjectURL(photo.prepared.previewUrl));
    cover = null;
    gallery.length = 0;
    slugEdited = false;
    renderCover();
    renderGallery();
    clearErrors();
    progress.replaceChildren();
    result.hidden = true;
    photoStatus.textContent = '';
    $('#restored-note').hidden = true;
    syncPartnerRoles();
    renderPreview();
    clearSaved();
  };

  $('#clear-draft').addEventListener('click', () => {
    if (confirm('Clear the whole form, including photos?')) resetForm();
  });
  $('#start-over').addEventListener('click', resetForm);

  window.addEventListener('beforeunload', (event) => {
    if (busy) event.preventDefault();
  });

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      restore(JSON.parse(saved) as SavedDraft);
      $('#restored-note').hidden = false;
    }
  } catch {
    // Ignore unreadable saved drafts.
  }
  renderPreview();

  // ── Access check ───────────────────────────────────────────────

  if (demo) {
    status.textContent = 'Demo mode (local preview only): nothing is sent.';
    return;
  }
  void (async () => {
    await refreshSession().catch(() => null);
    const user = await getUser().catch(() => null);
    if (!user?.roles?.includes(ADMIN_ROLE)) {
      status.textContent = 'Please sign in with a committee admin account to send drafts.';
      submitButton.disabled = true;
    }
  })();
}
