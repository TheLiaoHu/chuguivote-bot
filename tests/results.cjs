const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../results');
const now=Date.parse('2026-11-04T12:00:00Z');
function feed(){return {election_date:'2026-11-03',source:{name:'Test source',url:'https://example.com'},races:[{id:'TX-gov',state:'TX',office:'governor',status:'reporting',updated_at:'2026-11-04T11:59:00Z',reporting_percent:50,candidates:[{id:'a',name:'Test A',party:'DEM',votes:12},{id:'b',name:'Test B',party:'REP',votes:10}]}]};}
function governor(){return {state:'TX',name:'Test Incumbent',party:'REP',source_name:'Test directory',source_url:'https://example.com/governor',verified_at:'2026-11-04T11:00:00Z'};}
test('valid feed distinguishes a lead from a source-declared winner',()=>{
 const f=E.validate(feed(),'2026-11-03',now);assert.equal(E.leader(f.races[0]).id,'a');assert.equal(f.races[0].candidates[0].winner,undefined);
 f.races[0].candidates[1].votes=12;assert.equal(E.leader(f.races[0]),null);
 f.races[0].status='projected';f.races[0].candidates[1].winner=true;assert.equal(E.leader(E.validate(f,'2026-11-03',now).races[0]).id,'b');
});
test('rejects wrong elections, unsafe links, future times and inconsistent calls',()=>{
 const edits=[f=>f.election_date='2024-11-05',f=>f.source.url='javascript:alert(1)',f=>f.races.push({...f.races[0]}),f=>f.races[0].updated_at='2026-11-05T00:00:00Z',f=>f.races[0].reporting_percent=101,f=>f.races[0].candidates[0].votes=-1,f=>f.races[0].candidates[0].winner=true,f=>f.races[0].status='certified',f=>f.races[0].state='XX',f=>f.races[0].candidates[1].id='a'];
 for(const edit of edits){const f=feed();edit(f);assert.throws(()=>E.validate(f,'2026-11-03',now));}
});
test('governor theme is independent of race leads and reverts when stale',()=>{
 const g=governor();E.validateGovernors({governors:[g]},now);assert.equal(E.leader(feed().races[0]).party,'DEM');assert.equal(E.governorTheme(g,now,30),'republican');assert.equal(E.governorTheme(g,now+31*86400000,30),'neutral');assert.equal(E.governorTheme(null,now,30),'neutral');
 for(const [party,theme] of [['DEM','democratic'],['IND','independent'],['OTHER','other']]) assert.equal(E.governorTheme({...g,party},now,30),theme);
});
test('governor directory rejects unsupported jurisdictions, duplicates and future checks',()=>{
 const g=governor();for(const entry of [{...g,state:'DC'},{...g,party:'unknown'},{...g,verified_at:'2027-01-01T00:00:00Z'},{...g,source_url:'http://example.com'}])assert.throws(()=>E.validateGovernors({governors:[entry]},now));assert.throws(()=>E.validateGovernors({governors:[g,g]},now));assert.deepEqual(E.validateGovernors({governors:[]},now),{governors:[]});
});
test('race questions and stale updates remain distinct from ballot guidance',()=>{
 for(const q of ['Who won the Senate race in TX?','Governor results','Who is leading in Ohio?'])assert.equal(E.intent(q),true);
 assert.equal(E.intent('When is my ballot due in Ohio?'),false);assert.equal(E.office('senate results'),'senate');assert.equal(E.office('senate and governor results'),'all');assert.equal(E.stale(feed().races[0],now,15),false);assert.equal(E.stale(feed().races[0],now+3600000,15),true);
});
