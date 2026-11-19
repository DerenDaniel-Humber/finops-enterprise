// Shared Mongo persistence boundary used by application services.
function queryWithSession(query,session,sort){if(sort)query.sort(sort);if(session)query.session(session);return query;}
const findOne=(Model,filter,session,sort)=>queryWithSession(Model.findOne(filter),session,sort);
const findMany=(Model,filter,session,sort)=>queryWithSession(Model.find(filter),session,sort);
const createMany=(Model,documents,session)=>Model.create(documents,session?{session}:undefined);
const save=(document,session)=>document.save(session?{session}:undefined);
const updateOne=(Model,filter,update,session)=>Model.updateOne(filter,update,session?{session}:{});
module.exports={findOne,findMany,createMany,save,updateOne};
