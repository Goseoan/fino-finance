import {test} from "node:test";
import assert from "node:assert/strict";
import {groupAssets,classificationLabel,orderedLabels,ASSET_TYPES} from "../lib/classification";
test("display grouping is stable, keeps custom/unclassified items, and totals active assets only",()=>{
 const assets=[
 {id:"a",name:"항목10",category:"현금",value:300,active:true},
 {id:"b",name:"항목2",category:"현금 ",value:200,active:false},
 {id:"c",name:"사용자 항목",category:"수집품",value:50,active:true},
 {id:"d",name:"확인할 항목",category:" ",value:20,active:true},
 {id:"e",name:"삭제 항목",category:"현금",value:999,active:false,deletedAt:"2026-01-01"},
 ];
 const before=structuredClone(assets), groups=groupAssets(assets);
 assert.deepEqual(groups.map(g=>g.label),["현금","미분류","수집품"]);
 assert.deepEqual(groups[0].items.map(a=>a.id),["b","a"]);
 assert.equal(groups[0].count,2);assert.equal(groups[0].total,300);
 const ids=groups.flatMap(g=>g.items.map(a=>a.id));assert.equal(new Set(ids).size,4);assert.equal(ids.length,4);
 assert.equal(groups.reduce((s,g)=>s+g.total,0),370);
 assert.deepEqual(assets,before);
 assert.equal(classificationLabel("   "),"미분류");
 assert.deepEqual(orderedLabels(["투자","현금","투자","사용자"],ASSET_TYPES),["현금","투자","사용자"]);
});
