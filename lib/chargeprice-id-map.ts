// Chargeprice uses its own provider/tariff IDs — map them to our emsp_plans.id
// (spec Block 1.9). Extend as coverage grows; unknown IDs are skipped by the
// sync with a warning, never guessed.
export const CHARGEPRICE_ID_MAP: Record<string, string> = {
  // chargeprice_provider_or_tariff_id : our emsp_plans.id
  'chargemap': 'chargemap-pass-gratuit',
  'chargemap-pro': 'chargemap-pass-pro',
  'plugsurfing': 'plugsurfing-go',
  'plugsurfing-plus': 'plugsurfing-plus',
  'ionity-standard': 'ionity-standard',
  'ionity-plus': 'ionity-plus',
  'total-energies': 'totalenergies-standard',
  'freshmile': 'freshmile-standard',
  'electra': 'electra-standard',
  'be-charge': 'becharge-standard',
  'enel-x-way': 'enelxway-standard',
  'shell-recharge': 'shell-recharge-standard',
  'maingau-energie': 'maingau-standard',
};
