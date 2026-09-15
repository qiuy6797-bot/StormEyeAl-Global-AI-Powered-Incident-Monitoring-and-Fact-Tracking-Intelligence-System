import type { Industry } from "./types";

export function inferIndustry(text: string): Industry {
  const value = text.toLowerCase();
  if (/\b(batter(?:y|ies)|energy|electricity|power grid|manufactur\w*|industrial|supply chain|factory|factories)\b|电池|能源|电力|储能|工业|制造|供应链/.test(value)) return "能源与工业";
  if (/\b(robot(?:s|ics|ic)?|self-driving|autonomous (?:vehicle|driving|car)|drone(?:s)?|humanoid(?:s)?)\b|机器人|自动驾驶|无人机|具身/.test(value)) return "机器人与自动驾驶";
  if (/\b(finance|financial|bank(?:s|ing)?|fintech|trading|insurance)\b|金融|银行|保险|证券/.test(value)) return "金融";
  if (/\b(health\w*|medical|clinical|biolog\w*|biomolecul\w*|molecule(?:s)?|genom\w*|proteom\w*|antimicrobial|drug(?:s)?|bionemo|protein(?:s)?)\b|医疗|生命科学|药物|蛋白|生物|制药/.test(value)) return "医疗与生命科学";
  if (/\b(policy|regulat\w*|law(?:s)?|safety|security|audit\w*|governance|cyber\w*)\b|监管|法规|安全|治理/.test(value)) return "安全与政策";
  if (/\b(agent(?:s|ic)?|office|workflow(?:s)?|copilot|assistant(?:s)?|productivity)\b|智能体|办公|工作流/.test(value)) return "智能体与办公";
  if (/\b(inference|gpu(?:s)?|hardware|developer(?:s)?|runtime|tool(?:s|ing)?|github|storage|cuda|compiler)\b|推理|芯片|开发者|运行时/.test(value)) return "开发者基础设施";
  return "基础模型";
}
