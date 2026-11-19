const {asyncHandler}=require('../utils');const service=require('../services/transactions');
module.exports={
 initiate:asyncHandler(async(req,res)=>{const result=await service.initiate({...req.body,idempotencyKey:req.get('Idempotency-Key')||req.body.idempotencyKey});res.status(201).json(result);}),
 process:asyncHandler(async(req,res)=>res.json(await service.process(req.params.id)))
};
