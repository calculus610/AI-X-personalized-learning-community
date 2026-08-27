import test from "node:test"
import assert from "node:assert/strict"
import { CAREERS, CAREER_BY_ID, serializeCareerCatalog } from "../career-catalog.mjs"
import { COURSE_COMPETENCY_MAP } from "../course-competency-map.mjs"
import { CAREER_RECOMMENDATION_CONFIG, RecommendationInputError, recommendCareerCourses } from "../career-course-recommendation.mjs"
import { registerCareerRoutes } from "../career-routes.mjs"

const moduleByCourse = Object.fromEntries([
  ...["model-evaluation","agent-handoff","desktop-agent","device-gateway"].map((id)=>[id,"ai_agent"]),
  ...["ai-cad","blender-automation","laser-uv","cam-toolpath","manufacturing-quality"].map((id)=>[id,"ai_manufacturing"]),
  ...["electronics-basics","sensors-oled","edge-sensor-fusion","ultrasonic-decision","camera-vision","audio-edge-ai","audio-control","edge-ai-training","multimodal-edge-ai"].map((id)=>[id,"embedded_perception"]),
  ...["touch-interface","multi-actuator","ai-device-linkage","embodied-collaboration","build-smart-car"].map((id)=>[id,"embodied_projects"]),
])
const courses = COURSE_COMPETENCY_MAP.map((item,index)=>({id:item.courseId,moduleId:moduleByCourse[item.courseId],moduleName:moduleByCourse[item.courseId],title:item.courseId,sortOrder:index+1,status:"PUBLISHED",isSelectableTarget:true,hasContent:true}))
const relations = [
  ["model-evaluation","agent-handoff"],["agent-handoff","desktop-agent"],["ai-cad","laser-uv"],["ai-cad","cam-toolpath"],["cam-toolpath","manufacturing-quality"],
  ["electronics-basics","sensors-oled"],["electronics-basics","camera-vision"],["electronics-basics","audio-edge-ai"],["electronics-basics","multi-actuator"],
  ["sensors-oled","edge-sensor-fusion"],["sensors-oled","ultrasonic-decision"],["sensors-oled","touch-interface"],["multi-actuator","ai-device-linkage"],
  ["multi-actuator","build-smart-car"],["ultrasonic-decision","build-smart-car"],["ai-device-linkage","build-smart-car"],
].map(([prerequisiteCourseId,targetCourseId])=>({prerequisiteCourseId,targetCourseId,relationType:"REQUIRED_PREREQUISITE"}))
const recommend = (careerId, options={}) => recommendCareerCourses({careerId,limit:options.limit??5,courses:options.courses??courses,completedCourseIds:options.completed??[],relations:options.relations??relations})

test("catalog contains 30 distinct, valid careers",()=>{
  assert.equal(CAREERS.length,30)
  assert.equal(new Set(CAREERS.map((item)=>JSON.stringify(Object.entries(item.competencies).sort()))).size,30)
  assert.equal(serializeCareerCatalog().categories.length,5)
})
test("same input is deterministic and results are unique and capped",()=>{
  const first=recommend("robot-perception-engineer"),second=recommend("robot-perception-engineer")
  assert.deepEqual(first,second);assert.ok(first.recommendedCourses.length<=5)
  assert.equal(new Set(first.recommendedCourses.map((item)=>item.courseId)).size,first.recommendedCourses.length)
})
test("completed and unavailable courses are filtered",()=>{
  const completed=recommend("computer-vision-engineer",{completed:["camera-vision"]})
  assert.ok(!completed.recommendedCourses.some((item)=>item.courseId==="camera-vision"))
  const changed=courses.map((item)=>item.id==="camera-vision"?{...item,isSelectableTarget:false}:item)
  assert.ok(!recommend("computer-vision-engineer",{courses:changed}).recommendedCourses.some((item)=>item.courseId==="camera-vision"))
})
test("zero-overlap courses are not added to fill the limit",()=>{
  const subset=courses.filter((item)=>["electronics-basics","desktop-agent"].includes(item.id))
  const result=recommend("agent-development-engineer",{courses:subset,relations:[]})
  assert.deepEqual(result.recommendedCourses.map((item)=>item.courseId),["desktop-agent"])
})
test("high career fit ranks first and structured reasons are returned",()=>{
  const result=recommend("computer-vision-engineer")
  assert.equal(result.recommendedCourses[0].courseId,"camera-vision")
  assert.ok(result.recommendedCourses[0].matchedCompetencies.some((item)=>item.id==="computer-vision"))
  assert.ok(result.recommendedCourses[0].reasons.some((item)=>item.type==="career-match"))
})
test("coverage gain and redundancy affect later greedy rounds",()=>{
  const result=recommend("multimodal-ai-engineer")
  assert.ok(result.recommendedCourses.slice(1).some((item)=>item.scoreComponents.coverageGain>0))
  assert.ok(result.recommendedCourses.slice(1).some((item)=>item.scoreComponents.redundancy>0))
  const item=result.recommendedCourses.find((candidate)=>candidate.scoreComponents.redundancy>0)
  const withoutPenalty=.65*item.scoreComponents.baseFit+.25*item.scoreComponents.coverageGain+.10*item.scoreComponents.feasibility
  assert.ok(item.score<withoutPenalty)
})
test("missing prerequisites filter a course; available prerequisites retain it with an explanation",()=>{
  const target=courses.filter((item)=>item.id==="build-smart-car")
  assert.equal(recommend("smart-vehicle-engineer",{courses:target}).recommendedCourses.length,0)
  const full=recommend("smart-vehicle-engineer")
  const car=full.recommendedCourses.find((item)=>item.courseId==="build-smart-car")
  assert.ok(car);assert.equal(car.scoreComponents.feasibility,.7);assert.ok(car.reasons.some((item)=>item.type==="prerequisites-included"))
})
test("tie breaking is stable by sort order then course id",()=>{
  const subset=courses.filter((item)=>["audio-edge-ai","audio-control"].includes(item.id)).map((item)=>({...item,sortOrder:10}))
  const one=recommend("audio-ai-engineer",{courses:subset,relations:[]}),two=recommend("audio-ai-engineer",{courses:[...subset].reverse(),relations:[]})
  assert.deepEqual(one.recommendedCourses.map((item)=>item.courseId),two.recommendedCourses.map((item)=>item.courseId))
})
test("invalid career and limits are rejected",()=>{
  assert.throws(()=>recommend("missing"),RecommendationInputError)
  for(const limit of [0,6,1.5,"5"])assert.throws(()=>recommend("robotics-engineer",{limit}),RecommendationInputError)
})
test("empty and short candidate sets stay empty or short",()=>{
  assert.equal(recommend("robotics-engineer",{courses:[]}).recommendedCourses.length,0)
  assert.ok(recommend("embedded-systems-engineer",{courses:courses.slice(0,2),relations:[]}).recommendedCourses.length<5)
})
test("golden: embedded systems engineer prioritises electronics basics",()=>assert.equal(recommend("embedded-systems-engineer").recommendedCourses[0].courseId,"electronics-basics"))
test("golden: robot perception engineer includes vision and sensing",()=>{
  const ids=recommend("robot-perception-engineer").recommendedCourses.slice(0,4).map((item)=>item.courseId)
  assert.ok(ids.includes("camera-vision"));assert.ok(ids.some((id)=>["sensors-oled","edge-sensor-fusion","ultrasonic-decision"].includes(id)))
})
test("golden: AI product designer includes model evaluation or interaction design",()=>{
  const ids=recommend("ai-product-designer").recommendedCourses.slice(0,3).map((item)=>item.courseId)
  assert.ok(ids.some((id)=>["model-evaluation","touch-interface"].includes(id)))
})

function fakeApp(){const routes=new Map();return{routes,get(path,handler){routes.set(`GET ${path}`,handler)},patch(path,handler){routes.set(`PATCH ${path}`,handler)},post(path,handler){routes.set(`POST ${path}`,handler)}}}
function reply(){return{status:200,payload:null,code(value){this.status=value;return this},send(value){this.payload=value;return value}}}
function request(body,authenticated=true){return{body,user:authenticated?{sub:"user-1"}:null,async jwtVerify(){if(!authenticated)throw new Error("unauthorized")}}}
function apiDb(){
  const calls=[];let preference=null
  const execute=async(sql,params=[])=>{
    calls.push({sql,params})
    if(sql.includes("SELECT primary_career_id FROM user_profiles")&&sql.includes("FOR UPDATE"))return[[{primary_career_id:preference}]]
    if(sql.includes("UPDATE user_profiles"))preference=params[0]
    if(sql.includes("SELECT primary_career_id, career_preference_updated_at"))return[[{primary_career_id:preference,career_preference_updated_at:new Date("2026-08-04T00:00:00Z")}]]
    if(sql.includes("SELECT id,event_hash,sequence_no FROM event_integrity_records"))return[[]]
    if(sql.includes("SELECT last_sequence,last_event_hash FROM event_integrity_heads"))return[[{last_sequence:0,last_event_hash:null}]]
    if(sql.includes("FROM courses c"))return[courses.map((item)=>({id:item.id,module_id:item.moduleId,module_name:item.moduleName,title:item.title,summary:"",sort_order:item.sortOrder,status:item.status,is_selectable_target:1}))]
    if(sql.includes("FROM course_relations"))return[relations.map((item)=>({prerequisite_course_id:item.prerequisiteCourseId,target_course_id:item.targetCourseId,relation_type:item.relationType}))]
    if(sql.includes("user_course_completions"))return[[]]
    return[[]]
  }
  const connection={execute,async beginTransaction(){calls.push({sql:"BEGIN",params:[]})},async commit(){calls.push({sql:"COMMIT",params:[]})},async rollback(){calls.push({sql:"ROLLBACK",params:[]})},release(){calls.push({sql:"RELEASE",params:[]})}}
  return{calls,execute,async getConnection(){return connection}}
}
test("API authentication, catalogs, career persistence and recommendation contracts",async()=>{
  const app=fakeApp(),db=apiDb();registerCareerRoutes(app,db)
  let rep=reply();await app.routes.get("GET /v1/careers")(request(null,false),rep);assert.equal(rep.status,401)
  const catalog=await app.routes.get("GET /v1/careers")(request(),reply());assert.equal(catalog.version,"career-catalog-v1")
  rep=reply();await app.routes.get("PATCH /v1/profile/career-preference")(request({primaryCareerId:"invalid"}),rep);assert.equal(rep.status,400)
  const saved=await app.routes.get("PATCH /v1/profile/career-preference")(request({primaryCareerId:"robot-perception-engineer"}),reply());assert.equal(saved.primaryCareerId,"robot-perception-engineer")
  assert.ok(db.calls.find((call)=>call.sql.includes("SELECT primary_career_id FROM user_profiles")&&call.sql.includes("FOR UPDATE")))
  assert.ok(db.calls.find((call)=>call.sql.includes("UPDATE user_profiles")))
  const cleared=await app.routes.get("PATCH /v1/profile/career-preference")(request({primaryCareerId:null}),reply());assert.equal(cleared.primaryCareerId,null)
  const recommendation=await app.routes.get("POST /v1/course-recommendations/by-career")(request({careerId:"robot-perception-engineer",limit:5}),reply());assert.equal(recommendation.algorithmVersion,CAREER_RECOMMENDATION_CONFIG.algorithmVersion)
  rep=reply();await app.routes.get("POST /v1/course-recommendations/by-career")(request({careerId:"robot-perception-engineer",limit:6}),rep);assert.equal(rep.status,400)
  const emptyApp=fakeApp(),emptyDb={async execute(sql){if(sql.includes("FROM courses c")||sql.includes("FROM course_relations")||sql.includes("user_course_completions"))return[[]];return[[]]}};registerCareerRoutes(emptyApp,emptyDb)
  const empty=await emptyApp.routes.get("POST /v1/course-recommendations/by-career")(request({careerId:"robot-perception-engineer",limit:5}),reply());assert.deepEqual(empty.recommendedCourses,[])
})
