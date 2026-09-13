import {describe,it,expect} from 'vitest';
import {residentChoiceCandidates} from '../src/world/ResidentChoice';
describe('living resident choice under negative preference',()=>{
  it('keeps the child’s sole physical action after experience/noise lowers it below the preference threshold',()=>{
    expect(residentChoiceCandidates([{action:'rest',score:-.25056425567260676},{action:'hunt',score:-1},{action:'work',score:-Infinity}],new Set(['rest']),.4))
      .toEqual([{action:'rest',score:-.25056425567260676}]);
  });
  it('retains competing available choices without admitting an age/body forbidden action',()=>{
    const candidates=residentChoiceCandidates([{action:'gather',score:-.4},{action:'rest',score:-.45},{action:'hunt',score:3}],new Set(['gather','rest']),.2);
    expect(candidates.map(c=>c.action)).toEqual(['gather','rest']);
  });
});
