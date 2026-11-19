const crypto=require('node:crypto');
const id=(prefix)=>`${prefix}-${crypto.randomUUID()}`;
class HttpError extends Error { constructor(status,code,message,details=[]){super(message);this.status=status;this.code=code;this.details=details;} }
const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const page=(query)=>({page:Math.max(1,Number(query.page)||1),limit:Math.min(100,Math.max(1,Number(query.limit)||20))});
module.exports={id,HttpError,asyncHandler,page};
