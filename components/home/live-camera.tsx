'use client';
import { useState } from 'react';
export function LiveCamera({url}:{url:string}) {
  const [open,setOpen]=useState(false);
  return <section className="camera-panel" id="camera-ao-vivo" aria-labelledby="camera-title"><div className="panel-heading"><h2 id="camera-title">Câmera ao vivo</h2><span className="eyebrow">DIRETO DA BIOSFERA</span></div>
    <div className="camera-frame">{open ? <iframe src={url} title="Câmera ao vivo da Biosfera" allow="fullscreen" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" /> : <div className="camera-poster"><div className="camera-lens" aria-hidden="true"><span>◎</span></div><p>Uma janela para a Biosfera.</p><button type="button" className="button" onClick={()=>setOpen(true)}>▶ Assistir ao vivo</button><small>A transmissão começa quando você escolhe assistir.</small></div>}</div>
    {open && <div className="camera-help"><button type="button" className="text-button" onClick={()=>setOpen(false)}>Fechar transmissão</button><a href={url} target="_blank" rel="noopener noreferrer">Abrir player em outra aba ↗</a></div>}
  </section>;
}
