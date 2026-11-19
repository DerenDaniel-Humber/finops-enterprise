const {ApprovalWorkflow,ApprovalDecision,WorkflowActor,Transaction}=require('../models');
const {id,HttpError}=require('../utils');
const {mongoose}=require('../models');
const repository=require('../repositories/documentRepository');
async function decide(workflowId,{actorId,decision,comments},key){
 if(!key)throw new HttpError(400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key header is required.');
 if(!['Approved','Rejected'].includes(decision))throw new HttpError(400,'INVALID_DECISION','Decision must be Approved or Rejected.');
 if(decision==='Rejected'&&!String(comments||'').trim())throw new HttpError(400,'REJECTION_REASON_REQUIRED','A reason is required to reject a workflow.');
 const replay=await repository.findOne(ApprovalDecision,{idempotencyKey:key});if(replay){if(replay.workflowId!==workflowId||replay.actorId!==actorId||replay.decision!==decision||replay.comments!==String(comments||''))throw new HttpError(409,'IDEMPOTENCY_KEY_REUSED','This Idempotency-Key was already used for a different decision.');return {decision:replay,workflow:await repository.findOne(ApprovalWorkflow,{workflowId})};}
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const w=await repository.findOne(ApprovalWorkflow,{workflowId},session);if(!w)throw new HttpError(404,'WORKFLOW_NOT_FOUND','Approval workflow was not found.');
  if(!['Pending','InReview','Escalated'].includes(w.status))throw new HttpError(409,'WORKFLOW_TERMINAL','This workflow no longer accepts decisions.');
  const stage=w.requiredStages.find(s=>s.stageNumber===w.currentStage);if(!stage||stage.status==='Waiting')throw new HttpError(409,'INVALID_STAGE','No active approval stage is available.');
  const actor=await repository.findOne(WorkflowActor,{actorId,active:true},session);if(!actor)throw new HttpError(409,'ACTOR_NOT_ALLOWED','The selected reviewer is not an active seeded actor.');
  if(actor.role!==stage.requiredRole)throw new HttpError(409,'ROLE_MISMATCH',`Current stage requires ${stage.requiredRole}.`);
  const used=await repository.findOne(ApprovalDecision,{workflowId,actorId,decision:{$in:['Approved','Rejected']}},session);if(used)throw new HttpError(409,'SEPARATION_OF_DUTIES','A reviewer cannot decide more than one stage in the same workflow.');
  const record={decisionId:id('DEC'),workflowId,transactionId:w.transactionId,stageNumber:w.currentStage,actorId,actorName:actor.name,actorRole:actor.role,decision,comments:String(comments||''),decidedAt:new Date(),idempotencyKey:key};
  await repository.createMany(ApprovalDecision,[record],session);
  if(decision==='Rejected'){stage.status='Rejected';w.status='Rejected';}
  else {stage.status='Approved';const next=w.requiredStages.find(s=>s.stageNumber===w.currentStage+1);if(next){next.status='Pending';w.currentStage=next.stageNumber;w.status='InReview';}else w.status='Approved';}
  w.updatedAt=new Date();await repository.save(w,session);const tx=await repository.findOne(Transaction,{transactionId:w.transactionId},session);if(tx){tx.approvalStatus=w.status;await repository.save(tx,session);}
  result={decision:record,workflow:w};
 });return result;}finally{await session.endSession();}
}
async function escalate(workflowId,{actorId,reason}){
 if(!String(reason||'').trim())throw new HttpError(400,'ESCALATION_REASON_REQUIRED','A reason is required to escalate.');
 const session=await mongoose.startSession();let workflow;
 try{await session.withTransaction(async()=>{const w=await repository.findOne(ApprovalWorkflow,{workflowId},session);if(!w)throw new HttpError(404,'WORKFLOW_NOT_FOUND','Approval workflow was not found.');if(!['Pending','InReview','Escalated'].includes(w.status))throw new HttpError(409,'WORKFLOW_TERMINAL','This workflow cannot be escalated.');const actor=await repository.findOne(WorkflowActor,{actorId,active:true},session);const current=w.requiredStages.find(s=>s.stageNumber===w.currentStage);if(!actor||!current||actor.role!==current.requiredRole)throw new HttpError(409,'ROLE_MISMATCH','Only the assigned role may escalate the active stage.');const roleOrder=['OperationsReviewer','SeniorReviewer','ComplianceReviewer'];const dest=roleOrder[Math.min(roleOrder.indexOf(current.requiredRole)+1,roleOrder.length-1)];current.requiredRole=dest;current.assignedActorId=null;w.status='Escalated';w.escalations.push({actorId,actorName:actor.name,reason:String(reason).trim(),destinationRole:dest,createdAt:new Date()});w.updatedAt=new Date();await repository.save(w,session);const tx=await repository.findOne(Transaction,{transactionId:w.transactionId},session);if(tx){tx.approvalStatus=w.status;await repository.save(tx,session);}workflow=w;});return workflow;}finally{await session.endSession();}
}
module.exports={decide,escalate};
