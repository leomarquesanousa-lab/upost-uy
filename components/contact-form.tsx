'use client';
import { useState } from 'react';
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  return <form className="contact-form" onSubmit={event => { event.preventDefault(); setSubmitted(true); }} onChange={() => setSubmitted(false)} aria-describedby="contact-demo">
    <p id="contact-demo" className="contact-wide">Formulário de demonstração: os dados não serão enviados nem armazenados.</p>
    <label>Nome<input name="name" autoComplete="name" required maxLength={120}/></label>
    <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label>Telefone (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30}/></label>
    <label>Assunto<input name="subject" required maxLength={160}/></label>
    <label className="contact-wide">Mensagem<textarea name="message" required rows={6} maxLength={5000}/></label>
    <div className="contact-wide"><button className="button" type="submit">ENVIAR MENSAGEM</button><p role="status">{submitted ? 'Demonstração concluída. Sua mensagem não foi enviada e nenhum dado foi armazenado.' : ''}</p></div>
  </form>;
}
