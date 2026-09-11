/** Technical state remains inspectable, outside the observer's main view. */
export function installObserverChrome(root:HTMLElement) {
  const diagnostics=document.createElement('details');diagnostics.className='developer-diagnostics';
  const summary=document.createElement('summary');summary.textContent='Диагностика';diagnostics.append(summary);
  const entries=['live-indicator','world-level-value','cardinal-status-level','save-value','world-storage-details'];
  for(const id of entries) {
    const node=root.querySelector<HTMLElement>('#'+id);if(!node)continue;
    const container=id==='live-indicator'?node:id==='world-storage-details'?node.closest('details'):node.parentElement;
    if(container)diagnostics.append(container);
  }
  const error=document.createElement('pre');error.className='developer-diagnostics__error';diagnostics.append(error);
  root.querySelector('.world-maintenance')?.insertAdjacentElement('afterend',diagnostics);
  const notice=document.createElement('div');notice.className='world-notice';notice.setAttribute('role','alert');notice.hidden=true;
  const text=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='Подробности';
  button.addEventListener('click',()=>{diagnostics.open=true;diagnostics.scrollIntoView({block:'center'});});
  notice.append(text,button);root.querySelector('.world-header')?.insertAdjacentElement('afterend',notice);
  return {
    error(message:string){error.textContent=message;notice.hidden=false;text.textContent='Расчёт мира остановлен. Откройте подробности.';},
    clear(){notice.hidden=true;},
  };
}
