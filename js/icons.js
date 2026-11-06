/* Floorcraft — inline icon set (stroke icons, 24x24) */
(function () {
  const FC = (window.FC = window.FC || {});

  const paths = {
    cursor: '<path d="M5.3 3.6l5.7 15.2 2.1-6.2 6.3-2.2L5.3 3.6z"/>',
    hand: '<path d="M8 12.5V5.4a1.5 1.5 0 0 1 3 0v6.1m0-6.5a1.5 1.5 0 0 1 3 0V12m0-4.6a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1.1a5 5 0 0 1-4.1-2.1L4 13.6a1.6 1.6 0 0 1 2.6-1.8L8 13.6"/>',
    home: '<path d="M4 10.4L12 3.8l8 6.6"/><path d="M6.2 9.2V20h11.6V9.2"/><path d="M10 20v-5.2h4V20"/>',
    wall: '<rect x="3" y="4.6" width="18" height="14.8" rx="1.2"/><path d="M3 9.5h18M3 14.4h18M7.8 4.6v4.9M16.2 4.6v4.9M12 9.5v4.9M7.8 14.4v5M16.2 14.4v5"/>',
    door: '<path d="M14 3.8h3.2A1.8 1.8 0 0 1 19 5.6V20"/><path d="M2.5 20h19"/><path d="M14 4.5v15.5H5.5a1 1 0 0 1-1-1V7.8a2 2 0 0 1 1.4-1.9z"/><path d="M11.3 12v.1"/>',
    window: '<rect x="3" y="4.8" width="18" height="14.4" rx="1.4"/><path d="M12 4.8v14.4M3 12h18"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2.2"/><path d="M3 9h18M9.4 9v12"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    ortho: '<path d="M5 4v15h15"/><path d="M5 13h6v6"/>',
    ruler: '<path d="M3.8 15.1L15.1 3.8l5.1 5.1L9 20.2 3.8 15.1z"/><path d="M8 11l2 2M11 8l2 2M14 5l2 2"/>',
    light: '<path d="M9.2 18h5.6M10.2 21h3.6"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2.9 2V17h5.4v-1.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3z"/>',
    sliders: '<path d="M4 6.5h7M16 6.5h4M4 12h3M12 12h8M4 17.5h9M18 17.5h2"/><circle cx="13.5" cy="6.5" r="2.1"/><circle cx="9.5" cy="12" r="2.1"/><circle cx="15.5" cy="17.5" r="2.1"/>',
    undo: '<path d="M9 14.2L4 9.2l5-5"/><path d="M4 9.2h9.8a6 6 0 0 1 0 12h-3.2"/>',
    redo: '<path d="M15 14.2l5-5-5-5"/><path d="M20 9.2h-9.8a6 6 0 0 0 0 12h3.2"/>',
    layers: '<path d="M12 3l8.6 4.7L12 12.4 3.4 7.7 12 3z"/><path d="M3.4 12.1L12 16.8l8.6-4.7"/><path d="M3.4 16.4L12 21.1l8.6-4.7"/>',
    more: '<circle cx="5.2" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="18.8" cy="12" r="1.35" fill="currentColor" stroke="none"/>',
    'chevron-down': '<path d="M6 9.2l6 6 6-6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    check: '<path d="M5 12.6l4.5 4.5L19 6.9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    trash: '<path d="M4 6.8h16M9.2 6.8V3.8h5.6v3M6.2 6.8L7.2 20h9.6l1-13.2M10 10.6v5.6M14 10.6v5.6"/>',
    download: '<path d="M12 3.5v12M7.2 10.8L12 15.6l4.8-4.8M4 20h16"/>',
    upload: '<path d="M12 20.5v-12M7.2 13.2L12 8.4l4.8 4.8M4 4h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    sparkles: '<path d="M11.4 3.2l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3L5.6 9l4.3-1.5 1.5-4.3z"/><path d="M18.5 14.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
    cube: '<path d="M12 3l8.2 4.6v8.8L12 21l-8.2-4.6V7.6L12 3z"/><path d="M12 12l8.2-4.4M12 12L3.8 7.6M12 12v9"/>',
    camera: '<path d="M4 7.8h3.2L8.8 5.6h6.4l1.6 2.2H20a1 1 0 0 1 1 1v9.4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="7.8" r="0.7" fill="currentColor" stroke="none"/>',
    eye: '<path d="M2.8 12S6.4 5.6 12 5.6 21.2 12 21.2 12 17.6 18.4 12 18.4 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3"/>',
    rotate: '<path d="M20 7.2v5h-5"/><path d="M19.2 12a7.2 7.2 0 1 0-2 4.9"/>',
    sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M5.2 18.8l1.5-1.5M17.3 6.7l1.5-1.5"/>',
    moon: '<path d="M20.2 14.6A8.2 8.2 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 1 1 3.9 2.5c-.8.4-1.3 1.1-1.3 2v.5"/><circle cx="12" cy="17.2" r="0.75" fill="currentColor" stroke="none"/>',
    pencil: '<path d="M4 20l4.2-1.1L20 7.1 16.9 4 5.1 15.8 4 20z"/><path d="M14.8 6.1l3.1 3.1"/>',
    copy: '<rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2"/><path d="M15.6 8.4V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.6a2 2 0 0 0 2 2h2.4"/>',
    save: '<path d="M5 3.8h10.5L19 7.3V20H5V3.8z"/><path d="M8.2 3.8v5.6h6.6V3.8M8.2 20v-6.6h7.6V20"/>',
    file: '<path d="M6.2 3.8h7.6l4 4V20H6.2z"/><path d="M13.8 3.8v4h4"/>',
    folder: '<path d="M3.4 7a2 2 0 0 1 2-2h3.8l2 2h7.4a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2V7z"/>',
    'arrow-right': '<path d="M4 12h15M14 6.8L19.2 12 14 17.2"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18h1.4a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4h1.5a3 3 0 0 0 3-3A9 9 0 0 0 12 3z"/><circle cx="7.6" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10.2" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="6.9" r="1" fill="currentColor" stroke="none"/><circle cx="17.1" cy="10.4" r="1" fill="currentColor" stroke="none"/>',
    ceiling: '<path d="M3.4 5.2h17.2M5.2 5.2v4.4h13.6V5.2M8.2 20h7.6M12 9.6V20"/>',
    xray: '<path d="M12 3l8.2 4.6v8.8L12 21l-8.2-4.6V7.6L12 3z"/><path d="M7.7 16.4l8.6-8.8" stroke-dasharray="2 3"/><path d="M12 12l8.2-4.4M12 12L3.8 7.6M12 12v9"/>',
    key: '<circle cx="8.2" cy="15.8" r="3.6"/><path d="M10.8 13.2L19 5M15.6 8.4l2.2 2.2M17.8 6.2l2.2 2.2"/>',
    rotate3d: '<path d="M4 8.2c2.8-3.2 7-4.3 10.7-2.9 3.7 1.4 6 4.9 5.7 8.8"/><path d="M20.4 9.8l-.5 4.3-4.2-.7"/><path d="M20 15.8c-2.8 3.2-7 4.3-10.7 2.9-3.7-1.4-6-4.9-5.7-8.8"/><path d="M3.6 14.2l.5-4.3 4.2.7"/>',
    sofa: '<path d="M5 12V8.4A2.4 2.4 0 0 1 7.4 6h9.2A2.4 2.4 0 0 1 19 8.4V12"/><path d="M3.8 12a2 2 0 0 1 2 2v1.8h12.4V14a2 2 0 1 1 2 0v3.4a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 1 2-2z"/>',
    bed: '<path d="M3.4 19v-9.2M3.4 15h17.2v4M20.6 19v-5a3 3 0 0 0-3-3H9.4v4"/><path d="M3.4 12.4h6V9h11.2a3 3 0 0 1 3 3v1.4"/><circle cx="7.2" cy="8.2" r="1.3"/>',
  };

  FC.icon = function (name, cls) {
    const p = paths[name] || paths.info;
    return (
      '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'
    );
  };

  FC.hydrateIcons = function (root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      const name = el.getAttribute('data-icon');
      el.innerHTML = FC.icon(name);
      el.removeAttribute('data-icon');
    });
  };

  FC.swatchIcon = function (name) {
    return FC.icon(name || 'palette');
  };
})();
