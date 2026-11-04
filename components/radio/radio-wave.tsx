export function RadioWave({playing=false,compact=false}:{playing?:boolean;compact?:boolean}) {
 return <span className={`radio-wave ${playing?'is-playing':''} ${compact?'wave-compact':''}`} aria-hidden="true">{Array.from({length:11},(_,index)=><span key={index}/>)}</span>;
}
