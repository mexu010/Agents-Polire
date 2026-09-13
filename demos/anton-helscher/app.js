const menu=document.querySelector('.menu-toggle');
const nav=document.querySelector('nav');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.classList.remove('open');}));
const contact=document.querySelector('#contact-dialog');
const form=document.querySelector('#contact-form');
const status=document.querySelector('#form-status');
function openContact(topic){form.reset();status.textContent='';form.elements.topic.value=topic||'Allgemeine Anfrage';contact.showModal();document.body.classList.add('modal-open');}
document.querySelectorAll('[data-contact]').forEach(b=>b.addEventListener('click',()=>openContact()));
document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>openContact(b.dataset.topic)));
form.addEventListener('submit',event=>{event.preventDefault();status.textContent='Demo erfolgreich getestet. Es wurde nichts versendet.';form.reset();});
document.querySelector('#sources-button').addEventListener('click',()=>{document.querySelector('#sources-dialog').showModal();document.body.classList.add('modal-open');});
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');if(dialog===contact){form.reset();status.textContent='';}});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});});
