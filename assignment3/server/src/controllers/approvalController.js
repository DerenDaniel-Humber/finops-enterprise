const {asyncHandler}=require('../utils');const service=require('../services/approval');
module.exports={
 decide:asyncHandler(async(req,res)=>res.json(await service.decide(req.params.id,req.body,req.get('Idempotency-Key')))),
 escalate:asyncHandler(async(req,res)=>res.json(await service.escalate(req.params.id,req.body)))
};
