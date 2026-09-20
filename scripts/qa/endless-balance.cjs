const fs=require('node:fs');
const {simulator,summarize}=require('../../tests/helpers/endless-simulation.cjs');
const count=Number(process.argv[2]??500), output=process.argv[3], compare=process.argv[4]==='compare';
if(!Number.isSafeInteger(count)||count<1||count>10000)throw new Error('Samples must be 1..10000');
function evaluate(overrides={}){
 const {run,config}=simulator(overrides),results={};
 for(const policy of ['none','adaptive','shield','offense'])results[policy]=summarize(Array.from({length:count},(_,i)=>run(i+1,policy)));
 return {config,results};
}
const methodology='Fixed seeds 1..N; player-visible information only; automatic policies are not human playtest data.';
const report={samplesPerPolicy:count,maxRounds:200,methodology,...(compare?{profiles:{
 baseline:evaluate({baseItemPrices:{heal_potion:20,cooling_charm:15,resonance_dust:35,holy_shield:55}}),
 selected:evaluate(),
 generous:evaluate({baseItemPrices:{heal_potion:15,cooling_charm:10,resonance_dust:25,holy_shield:40}})
 }}:evaluate())};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
