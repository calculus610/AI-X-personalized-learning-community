import test from "node:test"
import assert from "node:assert/strict"
import { registerUserDataRoutes } from "../user-data-routes.mjs"

function app(){const routes=new Map();return{routes,get(path,handler){routes.set(`GET ${path}`,handler)},patch(path,handler){routes.set(`PATCH ${path}`,handler)},post(path,handler){routes.set(`POST ${path}`,handler)},delete(path,handler){routes.set(`DELETE ${path}`,handler)}}}
function request(selectedInterestIds,userId="user-1",authenticated=true){return{body:{selectedInterestIds},user:authenticated?{sub:userId}:null,async jwtVerify(){if(!authenticated)throw new Error("unauthorized")}}}
function reply(){return{status:200,payload:null,code(value){this.status=value;return this},send(value){this.payload=value;return value},header(){return this}}}

test("dedicated interests PATCH authenticates, validates, deduplicates and isolates the user",async()=>{
  const calls=[];const db={async execute(sql,params=[]){calls.push({sql,params});return[[]]}}
  const instance=app();registerUserDataRoutes(instance,db,{})
  const handler=instance.routes.get("PATCH /v1/profile/interests")
  let rep=reply();await handler(request([],"user-1",false),rep);assert.equal(rep.status,401)
  const result=await handler(request(["esp32","esp32","sensor"],"user-2"),reply())
  assert.deepEqual(result.selectedInterestIds,["esp32","sensor"])
  const write=calls.at(-1);assert.equal(write.params[0],"user-2");assert.deepEqual(JSON.parse(write.params[1]),["esp32","sensor"])
  assert.match(write.sql,/ON DUPLICATE KEY UPDATE selected_interest_ids/)
  assert.doesNotMatch(write.sql,/UPDATE aspiration|UPDATE desired_skills|UPDATE future_identity/)
  const empty=await handler(request([],"user-3"),reply());assert.deepEqual(empty.selectedInterestIds,[])
  rep=reply();await handler(request(["not-authoritative"],"user-4"),rep);assert.equal(rep.status,400);assert.equal(calls.filter((call)=>call.params[0]==="user-4").length,0)
  rep=reply();await handler(request("esp32","user-5"),rep);assert.equal(rep.status,400)
})
