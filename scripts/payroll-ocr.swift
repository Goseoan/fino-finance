import Foundation
import Vision
import ImageIO
let directory=URL(fileURLWithPath:CommandLine.arguments[1])
var result:[[String:Any]]=[]
for name in try FileManager.default.contentsOfDirectory(atPath:directory.path).filter({$0.hasPrefix("image-")}) {
 let url=directory.appendingPathComponent(name)
 let request=VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["ko-KR","en-US"]
 request.usesLanguageCorrection = true
 try VNImageRequestHandler(url:url, options:[:]).perform([request])
 let rows=(request.results ?? []).compactMap { o -> [String:Any]? in
  guard let t=o.topCandidates(1).first else{return nil}
  return ["text":t.string,"confidence":t.confidence,"x":o.boundingBox.minX,"y":o.boundingBox.minY,"width":o.boundingBox.width,"height":o.boundingBox.height]
 }
 result.append(["file":name,"lines":rows])
}
let bytes=try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys])
try bytes.write(to:directory.appendingPathComponent("ocr.json"),options:.atomic)
