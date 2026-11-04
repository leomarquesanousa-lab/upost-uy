import sanitizeHtml from 'sanitize-html';
export function chatText(value,max){
 if(typeof value!=='string'||value.length>max)throw new Error(`Use no máximo ${max} caracteres.`);
 const clean=sanitizeHtml(value,{allowedTags:[],allowedAttributes:{}}).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
 if(!clean)throw new Error('Preencha o texto antes de enviar.');return clean;
}
