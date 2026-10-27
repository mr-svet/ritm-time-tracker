import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('every authored form is registered for unsaved-change protection by a stable ID',()=>{
 const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 const forms=source.match(/<form\b[^>]*>/g)||[];
 assert.ok(forms.length>0);
 for(const form of forms)assert.match(form,/\bid="[^"]+"/,`Unregistered form: ${form}`);
});
