import test from 'node:test';
import assert from 'node:assert/strict';
import {FormDrafts} from '../form-drafts.mjs';
function form({id='capture-form',dataset={},text=''}={}){
 const input={name:'text',id:'',type:'textarea',tagName:'TEXTAREA',value:text,defaultValue:text};
 const node={id,dataset:{...dataset},querySelectorAll:()=>[input]};
 return {node,input,root:{querySelectorAll:()=>[node]}};
}
test('Draft follows its mounted day when navigation context changes',()=>{
 const drafts=new FormDrafts(),first=form();drafts.mount(first.root,'user:today:2026-10-27');first.input.value='Unsent activity';drafts.capture(first.node,'user:today:2026-10-27');
 drafts.captureAll(first.root,'user:today:2026-10-28');
 const other=form();drafts.mount(other.root,'user:today:2026-10-28');assert.equal(other.input.value,'');
 const back=form();drafts.mount(back.root,'user:today:2026-10-27');assert.equal(back.input.value,'Unsent activity');
});
test('Acknowledgement preserves text entered while the request was in flight',()=>{
 const drafts=new FormDrafts(),f=form();drafts.mount(f.root,'user:today:2026-10-27');f.input.value='First';const sent=drafts.capture(f.node,'ignored');f.input.value='Second';drafts.capture(f.node,'ignored');
 drafts.acknowledge(sent,f.root);assert.equal(drafts.dirty,true);
 const back=form();drafts.mount(back.root,'user:today:2026-10-27');assert.equal(back.input.value,'Second');
});
test('Only confirmed snapshot is cleared; unchanged form is not recreated as dirty',()=>{
 const drafts=new FormDrafts(),f=form();drafts.mount(f.root,'day');f.input.value='Saved';const sent=drafts.capture(f.node,'day');drafts.acknowledge(sent,f.root);drafts.captureAll(f.root,'day');assert.equal(drafts.dirty,false);
});
test('New-entry draft can be reopened despite regenerated entry ID',()=>{
 const drafts=new FormDrafts(),a=form({id:'entry-form',dataset:{id:'first-id'}});drafts.mount(a.root,'day');a.input.value='Draft';drafts.capture(a.node,'day');
 const b=form({id:'entry-form',dataset:{id:'next-id'}});drafts.mount(b.root,'day');assert.equal(b.input.value,'Draft');
});
test('Login credentials are never captured',()=>{
 const drafts=new FormDrafts(),f=form({id:'login-form'});drafts.mount(f.root,'login');f.input.value='private password';assert.deepEqual(drafts.capture(f.node,'login'),[]);assert.equal(drafts.dirty,false);
});
test('Sensitive field IDs are excluded even if the field has an ordinary name',()=>{
 const drafts=new FormDrafts(),f=form();f.input.id='api-token';drafts.mount(f.root,'day');f.input.value='secret';drafts.capture(f.node,'day');assert.equal(drafts.dirty,false);
});
