// The entry point supplies screen implementations. Navigation never imports features.
let pages = {};

export function registerPages(definitions) {
  pages = { ...definitions };
}

export function renderPage(name) {
  const page = pages[name];
  if (!page) throw new Error('Unregistered page: ' + name);
  page.render();
}

export function enterPage(name) {
  const page = pages[name];
  if (!page) throw new Error('Unregistered page: ' + name);
  if (page.enter) page.enter();
  if (!page.shouldRender || page.shouldRender()) page.render();
}
