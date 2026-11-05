'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Brand } from '@/components/brand';
import styles from './public-header.module.css';

type Panel = 'navigation' | 'search';
const groups = [
  { title: 'Actualidad', links: [['/', 'Inicio'], ['/noticias', 'Últimas noticias'], ['/uruguay', 'Uruguay'], ['/mundo', 'Mundo'], ['/sociedad', 'Sociedad']] },
  { title: 'Miradas', links: [['/especialistas', 'Especialistas'], ['/opinion', 'Opinión'], ['/investigaciones', 'Investigaciones'], ['/te-explicamos', 'Te explicamos']] },
  { title: 'Cultura y deporte', links: [['/deportes', 'Deportes'], ['/cultura', 'Cultura']] },
  { title: 'Para ver y escuchar', links: [['/podcast', 'Podcast'], ['/radios', 'Radios en vivo'], ['/videos', 'Videos']] },
];
const featuredSections = new Set(['/opinion', '/investigaciones', '/especialistas', '/podcast']);

function Icon({ name }: { name: 'menu' | 'search' | 'user' | 'close' | 'arrow' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'menu' && <path d="M3 6h18M3 12h18M3 18h18"/>}
    {name === 'search' && <><circle cx="10.75" cy="10.75" r="6.75"/><path d="m16 16 4.5 4.5"/></>}
    {name === 'user' && <><circle cx="12" cy="8" r="3.25"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>}
    {name === 'close' && <path d="m6 6 12 12M18 6 6 18"/>}
    {name === 'arrow' && <path d="M5 12h14m-5-5 5 5-5 5"/>}
  </svg>;
}

export function PublicHeader({ date }: { siteName: string; date: string }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel | null>(null);
  const navigationDialog = useRef<HTMLDialogElement>(null);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');
  const panelsOpen = panel !== null;

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    if (!panelsOpen) return;
    const body = document.body, root = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.getPropertyValue('padding-right');
    const previousPriority = body.style.getPropertyPriority('padding-right');
    const previousGutter = root.style.getPropertyValue('scrollbar-gutter');
    const previousGutterPriority = root.style.getPropertyPriority('scrollbar-gutter');
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    // Reserve only an existing scrollbar's space. Overlay-scrollbar browsers
    // must not acquire a new empty gutter when a panel opens.
    if (scrollbarWidth > 0 && CSS.supports('scrollbar-gutter: stable')) root.style.setProperty('scrollbar-gutter', 'stable');
    const reserved = getComputedStyle(root).scrollbarGutter?.includes('stable');
    if (!reserved && scrollbarWidth > 0) {
      const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.setProperty('padding-right', `${padding + scrollbarWidth}px`);
    }
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
      if (previousPadding) body.style.setProperty('padding-right', previousPadding, previousPriority);
      else body.style.removeProperty('padding-right');
      if (previousGutter) root.style.setProperty('scrollbar-gutter', previousGutter, previousGutterPriority);
      else root.style.removeProperty('scrollbar-gutter');
    };
  }, [panelsOpen]);

  function openPanel(next: Panel, trigger: HTMLElement) {
    clearTimeout(closeTimer.current);
    origin.current = trigger;
    navigationDialog.current?.close();
    searchDialog.current?.close();
    setClosing(false);
    const dialog = next === 'navigation' ? navigationDialog.current : searchDialog.current;
    dialog?.showModal();
    setPanel(next);
    if (next === 'search') searchInput.current?.focus();
  }
  function finishClose() {
    navigationDialog.current?.close();
    searchDialog.current?.close();
    setPanel(null);
    setClosing(false);
    if (origin.current?.isConnected) origin.current.focus({ preventScroll: true });
  }
  function closePanels() {
    if (!navigationDialog.current?.open && !searchDialog.current?.open) return;
    clearTimeout(closeTimer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(finishClose, 200);
  }
  function nativeClose() {
    // A close event from switching panels must not reset the newly opened dialog.
    if (!navigationDialog.current?.open && !searchDialog.current?.open) {
      setPanel(null); setClosing(false);
    }
  }
  function backdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanels();
  }
  function isActive(href: string) {
    return pathname === href || (href === '/noticias' && pathname.startsWith('/noticias/'));
  }
  function keepFocusInPanel(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'))
      .filter(control => control.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <header className={styles.header} data-upost-header>
    <div className={styles.topbar}>
      <div className={`container ${styles.topbarInner}`}>
        <span>{date}</span>
        <span className={styles.location}>Montevideo, Uruguay</span>
      </div>
    </div>

    <div className={`container ${styles.mainRow}`} data-header-row>
      <div className={styles.leftControls}>
        <button type="button" className={styles.control} onClick={event => openPanel('navigation', event.currentTarget)} aria-label="Abrir menú" aria-controls="upost-navigation-panel" aria-expanded={panel === 'navigation'}>
          <Icon name="menu"/><span className={styles.controlLabel}>Menú</span>
        </button>
        <span className={styles.controlDivider} aria-hidden="true"/>
        <button type="button" className={`${styles.control} ${styles.desktopSearch}`} onClick={event => openPanel('search', event.currentTarget)} aria-label="Buscar noticias" aria-controls="upost-search-panel" aria-expanded={panel === 'search'}>
          <Icon name="search"/><span className={styles.searchLabel}>Buscar</span>
        </button>
      </div>

      <Link className={styles.logo} href="/" aria-label="UPOST.uy — Inicio" onClick={closePanels} data-header-logo>
        <Brand variant="header" preload/>
      </Link>

      <div className={styles.rightControls}>
        <Link className={styles.adminLink} href="/admin"><Icon name="user"/><span>Administración</span></Link>
        <button type="button" className={`${styles.control} ${styles.mobileSearch}`} onClick={event => openPanel('search', event.currentTarget)} aria-label="Buscar noticias" aria-controls="upost-search-panel" aria-expanded={panel === 'search'}>
          <Icon name="search"/>
        </button>
      </div>
    </div>

    <dialog id="upost-navigation-panel" ref={navigationDialog} className={styles.navigationDialog} data-closing={closing} aria-labelledby="upost-menu-heading" onKeyDown={keepFocusInPanel} onCancel={event => { event.preventDefault(); closePanels(); }} onClose={nativeClose} onClick={backdropClick}>
      <div className={styles.panelContent}>
        <div className={styles.panelHeading}>
          <div><p className={styles.panelEyebrow}>Secciones</p><h2 id="upost-menu-heading">Explorá UPOST</h2></div>
          <button type="button" autoFocus className={styles.closeButton} onClick={closePanels} aria-label="Cerrar menú"><Icon name="close"/></button>
        </div>
        <div className={styles.menuGroups}>
          {groups.map((group, index) => <nav key={group.title} aria-labelledby={`upost-menu-group-${index}`}>
            <h3 id={`upost-menu-group-${index}`}>{group.title}</h3>
            <ul>{group.links.map(([href, label]) => <li key={href}><Link href={href} className={featuredSections.has(href) ? styles.featuredSection : undefined} onClick={closePanels} aria-current={isActive(href) ? 'page' : undefined}>{label}</Link></li>)}</ul>
          </nav>)}
        </div>
        <div className={styles.panelFooter}>
          <nav aria-label="Institucional"><Link href="/medios-asociados" onClick={closePanels}>Medios asociados</Link><Link href="/contacto" onClick={closePanels}>Contacto</Link></nav>
          <Link href="/admin" onClick={closePanels} className={styles.panelAdmin}><Icon name="user"/>Administración <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </dialog>

    <dialog id="upost-search-panel" ref={searchDialog} className={styles.searchDialog} data-closing={closing} aria-labelledby="upost-search-heading" onKeyDown={keepFocusInPanel} onCancel={event => { event.preventDefault(); closePanels(); }} onClose={nativeClose} onClick={backdropClick}>
      <div className={styles.panelContent}>
        <div className={styles.panelHeading}><h2 id="upost-search-heading">Buscar en UPOST</h2><button type="button" className={styles.closeButton} onClick={closePanels} aria-label="Cerrar búsqueda"><Icon name="close"/></button></div>
        <form className={styles.searchForm} action="/busca" role="search" onSubmit={closePanels}>
          <label htmlFor="upost-search-input">Buscá por tema, palabra clave o protagonista</label>
          <div className={styles.searchRow}>
            <div className={styles.searchField}><Icon name="search"/><input ref={searchInput} id="upost-search-input" type="search" name="q" placeholder="Buscar noticias..." value={query} onChange={event => setQuery(event.target.value)} required maxLength={200} autoFocus autoComplete="off"/>{query && <button className={styles.clearSearch} type="button" aria-label="Limpiar búsqueda" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><Icon name="close"/></button>}</div>
            <button className={styles.searchSubmit} type="submit" aria-label="Buscar"><span>Buscar</span><Icon name="arrow"/></button>
          </div>
        </form>
      </div>
    </dialog>
  </header>;
}
