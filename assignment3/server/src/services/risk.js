const {RiskPolicy,RiskAssessment,ApprovalPolicy,ApprovalWorkflow,Transaction,Account,Client}=require('../models');
const {id,HttpError}=require('../utils');const repository=require('../repositories/documentRepository');
const defaultRules=[
 {ruleId:'RISK-001',name:'Large transfer',description:'Amount is at least 10,000',points:15,condition:'amountAtLeast',value:1000000,enabled:true},
 {ruleId:'RISK-002',name:'Very large transfer',description:'Amount is at least 50,000',points:20,condition:'amountAtLeast',value:5000000,enabled:true},
 {ruleId:'RISK-003',name:'Exceptional transfer',description:'Amount is at least 100,000',points:25,condition:'amountAtLeast',value:10000000,enabled:true},
 {ruleId:'RISK-004',name:'Frequent outgoing activity',description:'At least five completed outgoing transfers in 24 hours',points:15,condition:'count24hAtLeast',value:5,enabled:true},
 {ruleId:'RISK-005',name:'High outgoing volume',description:'Completed outgoing volume in 24 hours is at least 100,000',points:20,condition:'volume24hAtLeast',value:10000000,enabled:true},
 {ruleId:'RISK-006',name:'High balance utilization',description:'Transfer exceeds 50% of source balance',points:15,condition:'amountOverBalanceRatio',value:.5,enabled:true},
 {ruleId:'RISK-007',name:'Source client not active',description:'Source client is not Active',points:30,condition:'sourceClientNotActive',value:0,enabled:true},
 {ruleId:'RISK-008',name:'Destination client not active',description:'Destination client is not Active',points:30,condition:'destinationClientNotActive',value:0,enabled:true}
];
const routes={Medium:['OperationsReviewer'],High:['OperationsReviewer','SeniorReviewer'],Critical:['SeniorReviewer','ComplianceReviewer']};
async function activePolicy(currency,session){return repository.findOne(RiskPolicy,{currency,status:'Active'},session,{version:-1});}
function riskLevel(score,t={lowMax:24,mediumMax:49,highMax:74,criticalMax:100}){return score<=t.lowMax?'Low':score<=t.mediumMax?'Medium':score<=t.highMax?'High':'Critical';}
async function assess({transaction,source,destination,session}){
 const policy=await activePolicy(transaction.currency,session);if(!policy)throw new HttpError(503,'RISK_POLICY_UNAVAILABLE',`No active ${transaction.currency} risk policy is configured.`);
 const [sourceClient,destinationClient]=await Promise.all([repository.findOne(Client,{clientId:source.clientId},session),repository.findOne(Client,{clientId:destination.clientId},session)]);
 const since=new Date(Date.now()-86400000);const history=await repository.findMany(Transaction,{sourceAccountId:source.accountId,status:'Completed',currency:transaction.currency,processedAt:{$gte:since}},session);
 const inputs={amountMinor:transaction.amountMinor,currency:transaction.currency,sourceAccountStatus:source.status,destinationAccountStatus:destination.status,sourceBalanceMinor:source.availableMinor,completedOutgoingCount24h:history.length,completedOutgoingVolumeMinor24h:history.reduce((n,x)=>n+x.amountMinor,0),sourceClientStatus:sourceClient?.status||'Unknown',destinationClientStatus:destinationClient?.status||'Unknown'};
 const triggered=[];for(const r of policy.rules.filter(x=>x.enabled)){let yes=false,actual;
  if(r.condition==='amountAtLeast'){actual=inputs.amountMinor;yes=actual>=r.value;}
  if(r.condition==='count24hAtLeast'){actual=inputs.completedOutgoingCount24h;yes=actual>=r.value;}
  if(r.condition==='volume24hAtLeast'){actual=inputs.completedOutgoingVolumeMinor24h;yes=actual>=r.value;}
  if(r.condition==='amountOverBalanceRatio'){actual=inputs.sourceBalanceMinor?inputs.amountMinor/inputs.sourceBalanceMinor:1;yes=actual>r.value;}
  if(r.condition==='sourceClientNotActive'){actual=inputs.sourceClientStatus;yes=actual!=='Active';}
  if(r.condition==='destinationClientNotActive'){actual=inputs.destinationClientStatus;yes=actual!=='Active';}
  if(yes)triggered.push({ruleId:r.ruleId,points:r.points,reason:r.description,evaluatedInput:actual});
 }
 const score=Math.min(100,triggered.reduce((n,r)=>n+r.points,0)),level=riskLevel(score,policy.thresholds),approvalRequired=level!=='Low';
 const assessment=await repository.createMany(RiskAssessment,[{assessmentId:id('RISK'),transactionId:transaction.transactionId,policyId:policy.policyId,policyVersion:policy.version,riskScore:score,riskLevel:level,approvalRequired,triggeredRules:triggered,inputs,assessedAt:new Date()}],session);
 let workflow=null;const stages=(routes[level]||[]).map((role,i)=>({stageNumber:i+1,requiredRole:role,status:i===0?'Pending':'Waiting'}));
 if(stages.length){workflow=(await repository.createMany(ApprovalWorkflow,[{workflowId:id('APR'),transactionId:transaction.transactionId,assessmentId:assessment[0].assessmentId,status:'Pending',currentStage:1,requiredStages:stages}],session))[0];}
 else {workflow=(await repository.createMany(ApprovalWorkflow,[{workflowId:id('APR'),transactionId:transaction.transactionId,assessmentId:assessment[0].assessmentId,status:'NotRequired',requiredStages:[]}],session))[0];}
 transaction.riskAssessmentId=assessment[0].assessmentId;transaction.riskScore=score;transaction.riskLevel=level;transaction.approvalRequired=approvalRequired;transaction.approvalWorkflowId=workflow.workflowId;transaction.approvalStatus=workflow.status;await repository.save(transaction,session);
 return {assessment:assessment[0],workflow};
}
async function validateThresholds(t){if(!t||![t.lowMax,t.mediumMax,t.highMax,t.criticalMax].every(Number.isInteger)||t.lowMax<0||t.lowMax>=t.mediumMax||t.mediumMax>=t.highMax||t.highMax>=t.criticalMax||t.criticalMax!==100)throw new HttpError(400,'INVALID_THRESHOLDS','Risk thresholds must be integer boundaries covering 0–100 without gaps or overlap.');}
async function validateRules(rules){const allowed=['amountAtLeast','count24hAtLeast','volume24hAtLeast','amountOverBalanceRatio','sourceClientNotActive','destinationClientNotActive'];if(!Array.isArray(rules)||!rules.length)throw new HttpError(400,'INVALID_RULES','At least one risk rule is required.');const ids=new Set();for(const rule of rules){if(!rule.ruleId||ids.has(rule.ruleId)||!allowed.includes(rule.condition)||!Number.isInteger(rule.points)||rule.points<0||rule.points>100||typeof rule.enabled!=='boolean'||!Number.isFinite(Number(rule.value))||Number(rule.value)<0)throw new HttpError(400,'INVALID_RULES','Each rule needs a unique ID, supported condition, non-negative finite value, integer points from 0 to 100, and enabled flag.');ids.add(rule.ruleId);}}
module.exports={defaultRules,routes,activePolicy,assess,riskLevel,validateThresholds,validateRules};
