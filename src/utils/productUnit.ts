type ProductUnitShape = {
  unit?: string | null;
  customUnit?: string | null;
};

export function formatProductUnit(product: ProductUnitShape): string {
  const rawUnit = String(product.customUnit || product.unit || '').trim().toLowerCase();
  if (!rawUnit) return 'adet';
  if (rawUnit === 'other') return 'adet';
  if (rawUnit === 'gram') return 'gr';
  if (rawUnit === 'piece') return 'adet';
  if (rawUnit === 'liter') return 'lt';
  if (rawUnit === 'kilogram') return 'kg';
  return rawUnit;
}

