// Private form text stays only in this tab's memory. No browser storage is used.
const draftAllowed=form=>!!form?.id&&!/login|guest-access/.test(form.id);
const draftFields=form=>[...form.querySelectorAll('input,textarea,select')].filter(el=>
 !['password','hidden','file','submit','button'].includes(el.type)&&!/password|token|csrf|secret/i.test((el.name||'')+' '+(el.id||'')));
const draftValue=el=>['checkbox','radio'].includes(el.type)?el.checked:el.value;
const draftValues=form=>{const counts=new Map();return draftFields(form).map(el=>{
 const name=el.name||el.id||'field',occurrence=counts.get(name)||0;counts.set(name,occurrence+1);
 return {key:name+':'+occurrence,type:el.type,value:draftValue(el)};
});};
const draftIdentity=(form,context)=>JSON.stringify([context,form.id,
 form.id==='entry-form'&&form.dataset.editing!=='true'?'new':form.dataset.id||'',
 form.dataset.entry||'',form.dataset.activity||'',form.dataset.date||'',form.dataset.type||'',form.dataset.dictionary||'']);
const draftEqual=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
export class FormDrafts {
 constructor(){this.items=new Map();this.bindings=new WeakMap();this.baselines=new WeakMap();this.touched=new WeakSet();}
 bind(form,context){
  if(!draftAllowed(form))return null;
  if(!this.bindings.has(form)){this.bindings.set(form,draftIdentity(form,context));this.baselines.set(form,draftValues(form));}
  return this.bindings.get(form);
 }
 mount(root,context){
  for(const form of root.querySelectorAll('form[id]')){
   const key=this.bind(form,context),saved=key&&this.items.get(key);if(!saved)continue;
   const inputs=draftFields(form),current=draftValues(form);
   for(let i=0;i<inputs.length;i++){const field=saved.find(value=>value.key===current[i].key&&value.type===current[i].type);if(!field)continue;
    if(['checkbox','radio'].includes(inputs[i].type))inputs[i].checked=field.value;else inputs[i].value=field.value;
   }
   this.touched.add(form);
  }
 }
 capture(form,context){
  const key=this.bind(form,context);if(!key)return [];
  this.touched.add(form);const values=draftValues(form);
  if(draftEqual(values,this.baselines.get(form)))this.items.delete(key);else this.items.set(key,values);
  return [[key,structuredClone(values)]];
 }
 captureAll(root,context){for(const form of root.querySelectorAll('form[id]'))if(this.touched.has(form))this.capture(form,context);}
 acknowledge(snapshots,root){
  for(const [key,saved] of snapshots){
   if(!draftEqual(this.items.get(key),saved))continue;
   this.items.delete(key);
   for(const form of root.querySelectorAll('form[id]'))if(this.bindings.get(form)===key&&draftEqual(draftValues(form),saved)){
    this.touched.delete(form);this.baselines.set(form,draftValues(form));
   }
  }
 }
 get dirty(){return this.items.size>0;}
}
