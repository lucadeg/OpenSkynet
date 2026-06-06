/**
 * Page snapshot script
 *
 * Extracts interactive elements from the page for agent interaction
 */

export const SNAPSHOT_JS = `
(() => {
  const MAX = 120;
  let counter = 0;

  const interactiveTags = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'details', 'summary',
    'option', 'optgroup', 'fieldset', 'label', 'output',
  ]);

  const interactiveRoles = new Set([
    'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
    'menuitem', 'tab', 'switch', 'slider', 'spinbutton', 'searchbox',
    'treeitem', 'option', 'menuitemcheckbox', 'menuitemradio',
  ]);

  const contentTags = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'p', 'li', 'td', 'th',
  ]);

  function isInteractive(el) {
    if (interactiveTags.has(el.tagName.toLowerCase())) return true;
    const role = el.getAttribute('role');
    if (role && interactiveRoles.has(role.toLowerCase())) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && tabindex !== '-1') return true;
    if (el.tagName.toLowerCase() === 'div' && el.getAttribute('onclick')) return true;
    return false;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function truncate(s, max) {
    if (!s) return '';
    s = s.replace(/\\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function extractInfo(el) {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: truncate(el.innerText || el.textContent || '', 200),
      role: el.getAttribute('role') || '',
      placeholder: el.getAttribute('placeholder') || '',
      href: el.getAttribute('href') || '',
      src: el.getAttribute('src') || '',
      alt: el.getAttribute('alt') || '',
      type: el.getAttribute('type') || '',
      value: el.value || el.getAttribute('value') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      isVisible: isVisible(el),
      boundingBox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  const elements = [];

  // Clear existing markers
  document.querySelectorAll('[data-sediman-ref-id]').forEach(el => {
    el.removeAttribute('data-sediman-ref-id');
  });

  // Walk the DOM tree
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walk.nextNode()) && elements.length < MAX) {
    const el = node;
    const tag = el.tagName.toLowerCase();
    const isInter = isInteractive(el);
    const isContent = contentTags.has(tag);

    if (!isInter && !isContent) continue;
    if (!isVisible(el)) continue;

    const refId = counter++;
    el.setAttribute('data-sediman-ref-id', String(refId));
    elements.push({ refId, ...extractInfo(el) });
  }

  const scrollEl = document.scrollingElement || document.documentElement;
  return {
    elements,
    scrollPosition: {
      x: Math.round(scrollEl.scrollLeft || 0),
      y: Math.round(scrollEl.scrollTop || 0),
    },
  };
})();
`;
