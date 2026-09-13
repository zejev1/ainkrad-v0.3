/**
 * The economy is intentionally a separate subsystem from dungeon/RPG rules.
 * This module exposes only physical goods, prices, contracts and trade. Its
 * only bridge to adventures is the finite loot a resident actually carries.
 */
export {
  fulfillContractFromLivedActionV21,
  marketUnitPriceV21,
  recordPhysicalGoodsV21,
  recordTradeEvidenceV21,
  type LivedContractOutcomeV21,
} from './EmergentSocietyV21';

