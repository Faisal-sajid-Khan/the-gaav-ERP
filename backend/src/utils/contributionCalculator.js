'use strict';

/**
 * Phase 1 — MVP Unit-Economics Calculation Engine
 * 
 * Implements the 10 core unit-economics formulas:
 * 1. landed_cost = mfg_cost + other_direct_cost + SUM(shared_unit_costs)
 * 2. sale_count = bars ÷ channel.units_per_sale
 * 3. gross = unit_price × sale_count (unit_price is per SALE)
 * 4. net_billed = gross − discount
 * 5. IF tax_registered AND channel.price_includes_tax:
 *        tax = net_billed × tax_rate ÷ (1 + tax_rate)
 *    ELSE: tax = 0
 * 6. net_revenue = net_billed − tax (all downstream % calculated on this, never on gross)
 * 7. channel_cost = net_revenue × (commission_pct + gateway_pct)
 *                   + sale_count × (shipping_per_sale + other_variable_cost)
 * 8. cogs = bars × landed_cost ÷ product.units_per_sale
 * 9. contribution = net_revenue − channel_cost − cogs (CAN be negative; NEVER clamp to 0)
 * 10. margin = contribution ÷ net_revenue (return null when net_revenue is zero; never divide by gross)
 */
function calculateContribution({
  items = [],
  channel = {},
  taxRate = 0,
  taxRegistered = false,
  sharedUnitCosts = [],
  shippingCharged = 0,
  actualShippingExpense = 0,
  orderCosts = [],
  orderDiscount = 0
}) {
  // Normalize store tax configuration
  const parsedTaxRate = parseFloat(taxRate) || 0;
  const isTaxRegistered = Boolean(taxRegistered);

  // Normalize channel parameters
  const channelUnitsPerSale = Math.max(1, parseInt(channel.units_per_sale, 10) || 1);
  const channelPriceIncludesTax = channel.price_includes_tax !== undefined ? Boolean(channel.price_includes_tax) : true;
  const commissionPct = parseFloat(channel.commission_pct) || 0;
  const gatewayPct = parseFloat(channel.gateway_pct) || 0;
  const shippingPerSale = parseFloat(channel.shipping_per_sale) || 0;
  const otherVariableCost = parseFloat(channel.other_variable_cost) || 0;

  // Calculate sum of shared unit costs: SUM(shared_unit_costs)
  let sumSharedCosts = 0;
  if (Array.isArray(sharedUnitCosts)) {
    sharedUnitCosts.forEach(costLine => {
      sumSharedCosts += parseFloat(costLine.amount) || 0;
    });
  } else if (typeof sharedUnitCosts === 'number') {
    sumSharedCosts = sharedUnitCosts;
  }

  let totalBars = 0;
  let totalSaleCount = 0;
  let totalGross = 0;
  let totalItemDiscount = 0;
  let totalNetBilled = 0;
  let totalTax = 0;
  let totalNetRevenue = 0;
  let totalChannelCost = 0;
  let totalCogs = 0;
  let totalManufacturingCost = 0;
  let totalPackagingCost = 0;
  let totalOtherProductCost = 0;

  const calculatedItems = items.map(item => {
    // 1. Bars Sold & Units Per Sale
    const productUnitsPerSale = Math.max(1, parseInt(item.units_per_sale ?? item.product_units_per_sale, 10) || 1);
    const itemQty = parseFloat(item.quantity) || 0;
    // If bars is explicitly supplied, use it; otherwise bars = qty * product.units_per_sale
    const bars = item.bars !== undefined ? parseFloat(item.bars) : (itemQty * productUnitsPerSale);

    // 2. Sale Count: sale_count = bars ÷ channel.units_per_sale
    const lineChannelUnitsPerSale = Math.max(1, parseInt(item.channel_units_per_sale || channelUnitsPerSale, 10) || 1);
    const saleCount = lineChannelUnitsPerSale > 0 ? (bars / lineChannelUnitsPerSale) : itemQty;

    // 1. Landed unit cost: landed_cost = mfg_cost + other_direct_cost + SUM(shared_unit_costs)
    const mfgCost = parseFloat(item.manufacturing_cost_snapshot ?? item.manufacturing_cost ?? item.mfg_cost) || 0;
    const pkgCost = parseFloat(item.packaging_cost_snapshot ?? item.packaging_cost) || 0;
    const otherDirectCost = parseFloat(item.other_cost_snapshot ?? item.other_direct_cost ?? item.other_cost) || 0;
    const itemSharedCost = item.shared_cost_snapshot !== undefined ? (parseFloat(item.shared_cost_snapshot) || 0) : sumSharedCosts;
    const landedCost = mfgCost + pkgCost + otherDirectCost + itemSharedCost;

    // 3. Gross: gross = unit_price × sale_count (unit_price is per SALE)
    const unitPrice = parseFloat(item.selling_price ?? item.unit_price) || 0;
    const lineGross = unitPrice * saleCount;

    // 4. Net billed: net_billed = gross − discount
    const discount = parseFloat(item.discount) || 0;
    const lineNetBilled = lineGross - discount;

    // 5. Tax Extraction
    // IF tax_registered AND channel.price_includes_tax:
    //     tax = net_billed × tax_rate ÷ (1 + tax_rate)
    // ELSE: tax = 0
    let lineTax = 0;
    if (isTaxRegistered && channelPriceIncludesTax && parsedTaxRate > 0) {
      lineTax = (lineNetBilled * parsedTaxRate) / (1 + parsedTaxRate);
    }

    // 6. Net revenue: net_revenue = net_billed − tax
    const lineNetRevenue = lineNetBilled - lineTax;

    // 7. Channel cost:
    // channel_cost = net_revenue × (commission_pct + gateway_pct)
    //                + sale_count × (shipping_per_sale + other_variable_cost)
    const lineChannelCost = (lineNetRevenue * (commissionPct + gatewayPct))
                          + (saleCount * (shippingPerSale + otherVariableCost));

    // 8. COGS: cogs = bars × landed_cost ÷ product.units_per_sale
    const lineCogs = productUnitsPerSale > 0 ? ((bars * landedCost) / productUnitsPerSale) : (bars * landedCost);

    // 9. Contribution: contribution = net_revenue − channel_cost − cogs
    // Can legitimately be negative. DO NOT clamp to zero!
    const lineContribution = lineNetRevenue - lineChannelCost - lineCogs;

    // 10. Contribution margin: margin = contribution ÷ net_revenue (null when net_revenue is zero)
    const lineMargin = lineNetRevenue !== 0 ? (lineContribution / lineNetRevenue) : null;
    const lineMarginPct = lineMargin !== null ? (lineMargin * 100) : null;

    // Accumulate order totals
    totalBars += bars;
    totalSaleCount += saleCount;
    totalGross += lineGross;
    totalItemDiscount += discount;
    totalNetBilled += lineNetBilled;
    totalTax += lineTax;
    totalNetRevenue += lineNetRevenue;
    totalChannelCost += lineChannelCost;
    totalCogs += lineCogs;
    totalManufacturingCost += (mfgCost * bars);
    totalPackagingCost += (pkgCost * bars);
    totalOtherProductCost += (otherDirectCost * bars);

    return {
      ...item,
      bars_sold: bars,
      sale_count: parseFloat(saleCount.toFixed(4)),
      landed_cost_snapshot: parseFloat(landedCost.toFixed(4)),
      shared_cost_snapshot: parseFloat(itemSharedCost.toFixed(4)),
      manufacturing_cost_snapshot: parseFloat(mfgCost.toFixed(4)),
      packaging_cost_snapshot: parseFloat(pkgCost.toFixed(4)),
      other_cost_snapshot: parseFloat(otherDirectCost.toFixed(4)),
      line_gross: parseFloat(lineGross.toFixed(4)),
      net_billed: parseFloat(lineNetBilled.toFixed(4)),
      tax_amount: parseFloat(lineTax.toFixed(4)),
      net_revenue: parseFloat(lineNetRevenue.toFixed(4)),
      net_product_sales: parseFloat(lineNetRevenue.toFixed(4)), // backward compatibility
      channel_cost: parseFloat(lineChannelCost.toFixed(4)),
      cogs: parseFloat(lineCogs.toFixed(4)),
      line_contribution: parseFloat(lineContribution.toFixed(4)),
      line_margin: lineMargin !== null ? parseFloat(lineMargin.toFixed(4)) : null,
      line_margin_pct: lineMarginPct !== null ? parseFloat(lineMarginPct.toFixed(2)) : null,
    };
  });

  // Order-level discount handling
  const parsedOrderDiscount = parseFloat(orderDiscount) || 0;
  const totalDiscount = totalItemDiscount + parsedOrderDiscount;
  
  // Adjusted Order-level Net Billed & Tax if order-level discount applied
  const finalOrderNetBilled = Math.max(0, totalGross - totalDiscount);
  let finalOrderTax = totalTax;
  if (parsedOrderDiscount > 0 && isTaxRegistered && channelPriceIncludesTax && parsedTaxRate > 0) {
    finalOrderTax = (finalOrderNetBilled * parsedTaxRate) / (1 + parsedTaxRate);
  }
  
  // Shipping revenue charged to customer
  const shippingRevenue = parseFloat(shippingCharged) || 0;
  const finalNetRevenue = (finalOrderNetBilled - finalOrderTax) + shippingRevenue;

  // Additional order fees / courier shipping expense
  const courierExpense = parseFloat(actualShippingExpense) || 0;
  let additionalOrderCosts = 0;
  (orderCosts || []).forEach(c => {
    additionalOrderCosts += parseFloat(c.amount) || 0;
  });

  // Final channel cost includes line item channel costs + courier expense + manual order costs
  const finalChannelCost = totalChannelCost + courierExpense + additionalOrderCosts;

  // Final Contribution = net_revenue − channel_cost − cogs
  // Can legitimately be negative. DO NOT clamp to zero!
  const finalContribution = finalNetRevenue - finalChannelCost - totalCogs;

  // Final Margin = contribution ÷ net_revenue (return null when net_revenue is zero)
  const finalMargin = finalNetRevenue !== 0 ? (finalContribution / finalNetRevenue) : null;
  const finalMarginPct = finalMargin !== null ? (finalMargin * 100) : null;

  return {
    calculatedItems,
    barsTotal: Math.round(totalBars),
    saleCountTotal: parseFloat(totalSaleCount.toFixed(4)),
    grossSales: parseFloat(totalGross.toFixed(4)),
    discountTotal: parseFloat(totalDiscount.toFixed(4)),
    netBilled: parseFloat(finalOrderNetBilled.toFixed(4)),
    taxTotal: parseFloat(finalOrderTax.toFixed(4)),
    netRevenue: parseFloat(finalNetRevenue.toFixed(4)),
    netSales: parseFloat(finalNetRevenue.toFixed(4)), // alias for backward-compatibility
    channelCostTotal: parseFloat(finalChannelCost.toFixed(4)),
    cogsTotal: parseFloat(totalCogs.toFixed(4)),
    totalManufacturingCost: parseFloat(totalManufacturingCost.toFixed(4)),
    totalPackagingCost: parseFloat(totalPackagingCost.toFixed(4)),
    totalOtherProductCost: parseFloat(totalOtherProductCost.toFixed(4)),
    shippingCharged: parseFloat(shippingRevenue.toFixed(4)),
    actualShippingExpense: parseFloat(courierExpense.toFixed(4)),
    additionalOrderCosts: parseFloat(additionalOrderCosts.toFixed(4)),
    totalVariableCosts: parseFloat((finalChannelCost + totalCogs).toFixed(4)),
    contribution: parseFloat(finalContribution.toFixed(4)),
    contributionMargin: finalMargin !== null ? parseFloat(finalMargin.toFixed(4)) : null,
    contributionMarginPct: finalMarginPct !== null ? parseFloat(finalMarginPct.toFixed(2)) : null,
  };
}

module.exports = { calculateContribution };
