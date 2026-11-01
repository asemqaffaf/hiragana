// The entry point supplies screen implementations. Navigation never imports features.
/** @type {Partial<import('../../types/app').PageRegistry>} */
let pages = {};

/** @param {import('../../types/app').PageRegistry} definitions */
export function registerPages(definitions) {
  pages = { ...definitions };
}

/** @param {import('../../types/app').TabName} name */
export function renderPage(name) {
  const page = pages[name];
  if (!page) throw new Error('Unregistered page: ' + name);
  page.render();
}

/** @param {import('../../types/app').TabName} name @param {import('../../types/app').ShowTabOptions} [opts] */
export function enterPage(name, opts = {}) {
  const page = pages[name];
  if (!page) throw new Error('Unregistered page: ' + name);
  if (page.enter) page.enter(opts);
  if (!page.shouldRender || page.shouldRender()) page.render();
}
