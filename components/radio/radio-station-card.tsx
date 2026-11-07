'use client';
/* eslint-disable @next/next/no-img-element -- registered local station logo */
import type { RadioStation } from '@/server/services/portal-resources';
import { useRadio, radioLabels } from './radio-player';
import styles from './radio-player.module.css';
export function RadioStationCard({ station: initialStation, compact = false }: { station: RadioStation; compact?: boolean }) {
  const radio = useRadio();
  const station = compact ? radio.station || initialStation : initialStation;
  const selected = radio.station?.id === station.id;
  const active = selected && (radio.status === 'playing' || radio.status === 'loading');
  if (compact) return <article className={styles.compactCard} data-radio-station={station.id} data-home-radio>
    <div className={styles.stationOptions} role="group" aria-label="Seleccionar radio">
      {radio.stations.map(option => <button type="button" key={option.id} aria-pressed={option.id === station.id} title={option.name} onClick={() => radio.selectStation(option)}>{option.name === 'Radio Mix Artigas' ? 'Mix Artigas' : option.name.replace('Radio ', '').replace(' Ciudadana', '')}</button>)}
    </div>
    <div className={styles.compactBrand}>
      {station.imageUrl ? <img src={station.imageUrl} alt=""/> : <span className={styles.compactSymbol} aria-hidden="true">♪</span>}
      <div><small>Radio en vivo</small><h2>{station.name}</h2></div>
    </div>
    <div className={styles.compactControls}>
      <button type="button" className={styles.compactPlay} onClick={() => radio.playStation(station)} aria-label={`${active ? 'Pausar' : 'Escuchar'} ${station.name}`} aria-pressed={active}>{active ? 'Ⅱ' : '▶'}</button>
      <div className={styles.compactConnection}>
        <span role="status">{selected && radio.status !== 'paused' ? radioLabels[radio.status] : 'Escuchá en vivo'}</span>
        <input aria-label="Volumen de la radio" type="range" min="0" max="1" step=".01" value={radio.volume} onChange={event => radio.changeVolume(Number(event.target.value))}/>
      </div>
    </div>
  </article>;
  return <article className={styles.card} data-radio-station={station.id}>
    {station.imageUrl && <img src={station.imageUrl} alt="" loading="lazy"/>}
    <small>Radio en vivo</small><h2>{station.name}</h2><p>{station.location}</p>
    <a href={station.website} target="_blank" rel="noopener noreferrer">Sitio oficial ↗</a>
    <button type="button" onClick={() => radio.playStation(station)} aria-pressed={active}>{active ? 'Ⅱ Pausar' : '▶ Escuchar en vivo'}</button>
    <p role="status">{selected ? radioLabels[radio.status] : radioLabels.paused}</p>
  </article>;
}
