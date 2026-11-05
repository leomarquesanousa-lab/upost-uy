'use client';
export default function AdminError({reset}:{reset:()=>void}){return <section role="alert"><h1>No se pudo cargar esta sección</h1><p>La consulta no pudo completarse. Intentá nuevamente en unos segundos.</p><button type="button" className="button" onClick={reset}>Reintentar</button></section>;}
