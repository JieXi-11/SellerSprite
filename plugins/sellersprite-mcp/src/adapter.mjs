import { readFile } from 'node:fs/promises';

const operation = process.argv[2];
const inputArg = process.argv[3] || '{}';
const input = inputArg.startsWith('@')
  ? JSON.parse(await readFile(inputArg.slice(1), 'utf8'))
  : JSON.parse(inputArg);
const extensionId = 'lnbmbgocenenhhhdojdielgnmeflbnfb';
const extensionVersion = '5.0.4';

const marketIds = { US: 1, JP: 6, UK: 3, DE: 4, FR: 5, IT: 35691, ES: 44551, CA: 7, MX: 44571 };
const marketCodes = { US: 'COM', JP: 'CO.JP', UK: 'CO.UK', DE: 'DE', FR: 'FR', IT: 'IT', ES: 'ES', CA: 'CA', MX: 'COM.MX' };
const sortFields = {
  total_units: 'amz_unit',
  sales: 'amz_unit',
  revenue: 'total_amount',
  price: 'price',
  reviews: 'reviews',
  bsr: 'bsr_rank'
};

function competitorLookup(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const requestedPage = params.page ?? 1;
  const requestedSize = params.size ?? 50;
  const offset = (requestedPage - 1) * requestedSize;
  const body = {
    market,
    monthName: params.month || 'bsr_sales_nearly',
    asins: params.asins || [],
    nodeIdPaths: params.nodeIdPath ? [params.nodeIdPath] : [],
    page: Math.floor(offset / 60) + 1,
    size: 60,
    order: {
      field: sortFields[params.order?.field] || params.order?.field || 'amz_unit',
      desc: params.order?.desc ?? true
    },
    symbolFlag: params.variation === 'Y',
    q: params.keyword || '',
    lowPrice: 'N'
  };
  if (params.brand != null) body.brand = params.brand;
  if (params.sellerName != null) body.sellerName = params.sellerName;
  if (params.nodeIdPathEqual != null) body.nodeIdPathEqual = params.nodeIdPathEqual;
  if (params.matchType != null) body.matchType = params.matchType;
  if (params.variation != null) body.variation = params.variation;
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/competing-lookup',
    method: 'POST',
    body,
    metadata: { marketId: marketIds[market], requestedPage, requestedSize, sliceStart: offset % 60 }
  };
}

function productResearch(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const requestedPage = params.page ?? 1;
  const requestedSize = params.size ?? 60;
  const offset = (requestedPage - 1) * requestedSize;
  const list = (value) => Array.isArray(value)
    ? value.filter(Boolean)
    : String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const boolean = (value) => value === true || value === 'Y' || value === 'true';
  const productTags = list(params.productTags);
  if (params.badgeBS === 'Y') productTags.push('BestSeller');
  if (params.badgeAC === 'Y') productTags.push('AmazonChoice');
  if (params.badgeNR === 'Y') productTags.push('NewRelease');
  if (params.badgeAPlus === 'Y') productTags.push('A+');
  if (params.badgeNonAPlus === 'Y') productTags.push('NonA+');
  const pkgDimensionTypeList = list(params.pkgDimensionTypeList ?? params.dimensionType);
  const smallAndLight = boolean(params.smallAndLight)
    || list(params.eligibility).includes('Y')
    || pkgDimensionTypeList.includes('smallAndLight');
  if (smallAndLight && !pkgDimensionTypeList.includes('smallAndLight')) pkgDimensionTypeList.push('smallAndLight');
  const body = {
    market,
    page: Math.floor(offset / 60) + 1,
    size: 60,
    symbolFlag: params.variation == null ? false : boolean(params.variation),
    monthName: params.month || 'bsr_sales_nearly',
    video: params.video == null || params.video === '' ? '' : boolean(params.video),
    selectType: String(params.selectType ?? params.matchType ?? '2'),
    filterSub: boolean(params.filterSub),
    weightUnit: params.weightUnit || 'g',
    subCategoryCode: params.subCategoryCode || '',
    subCategoryDesc: params.subCategoryDesc || '',
    order: {
      field: sortFields[params.order?.field] || params.order?.field || 'amz_unit',
      desc: params.order?.desc ?? true
    },
    productTags: [...new Set(productTags)],
    nodeIdPaths: list(params.nodeIdPaths ?? params.nodeIdPath),
    sellerTypes: list(params.sellerTypes ?? params.fulfillment),
    eligibility: smallAndLight ? ['Y'] : list(params.eligibility),
    pkgDimensionTypeList,
    sellerNationList: list(params.sellerNationList ?? params.sellerNation),
    smallAndLight: smallAndLight ? 'Y' : 'N',
    lowPrice: 'N'
  };
  const mapping = {
    keyword: 'keywords', keywords: 'keywords', includeSellers: 'includeSellers', excludeSellers: 'excludeSellers',
    excludeKeywords: 'outOfKeywords', minPrice: 'minPrice', maxPrice: 'maxPrice', minRating: 'minReviewRating',
    maxRating: 'maxReviewRating', minRatings: 'minReviews', maxRatings: 'maxReviews', minRatingsCv: 'minReviewsGrouth',
    maxRatingsCv: 'maxReviewsGrouth', minSellers: 'minSellers', maxSellers: 'maxSellers', minProfit: 'minProfit',
    maxProfit: 'maxProfit', minBsr: 'minRanking', maxBsr: 'maxRanking', minBsrCv: 'minRankingCv', maxBsrCv: 'maxRankingCv',
    minBsrCr: 'minRankingCr', maxBsrCr: 'maxRankingCr', minUnits: 'minSales', maxUnits: 'maxSales',
    minAmzUnit: 'minAmzUnit', maxAmzUnit: 'maxAmzUnit', minRevenue: 'minAmount', maxRevenue: 'maxAmount',
    minUnitsCr: 'minTotalUnitsGrowth', maxUnitsCr: 'maxTotalUnitsGrowth',
    minTotalUnitsGrowth: 'minTotalUnitsGrowth', maxTotalUnitsGrowth: 'maxTotalUnitsGrowth',
    minTotalUnitsGrowthYoy: 'minTotalUnitsGrowthYoy', maxTotalUnitsGrowthYoy: 'maxTotalUnitsGrowthYoy',
    minTotalUnitsGrowthYoyContinuous3: 'minTotalUnitsGrowthYoyContinuous3', maxTotalUnitsGrowthYoyContinuous3: 'maxTotalUnitsGrowthYoyContinuous3',
    minTotalUnitsGrowthYoyContinuous6: 'minTotalUnitsGrowthYoyContinuous6', maxTotalUnitsGrowthYoyContinuous6: 'maxTotalUnitsGrowthYoyContinuous6',
    minVariations: 'minVariations', maxVariations: 'maxVariations', minSubBsrRank: 'minSubBsrRank',
    maxSubBsrRank: 'maxSubBsrRank', includeBrands: 'includeBrands', excludeBrands: 'excludeBrands',
    minFba: 'minFba', maxFba: 'maxFba', minLqs: 'lqsFrom', maxLqs: 'lqsTo', availableMonth: 'putawayMonth',
    minWeights: 'minWeights', maxWeights: 'maxWeights', minQuestions: 'minQuestions', maxQuestions: 'maxQuestions',
    minRatingsRate: 'minReviewsRate', maxRatingsRate: 'maxReviewsRate', minReviewsRate: 'minReviewsRate',
    maxReviewsRate: 'maxReviewsRate', minDeliveryPrice: 'minDeliveryPrice', maxDeliveryPrice: 'maxDeliveryPrice'
  };
  for (const [source, target] of Object.entries(mapping)) if (params[source] != null) body[target] = String(params[source]);
  if (params.nodeIdPathEqual != null) body.nodeIdPathEqual = boolean(params.nodeIdPathEqual);
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/product-research',
    method: 'POST',
    body,
    metadata: { marketId: marketIds[market], requestedPage, requestedSize, sliceStart: offset % 60 }
  };
}

function productNode(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const query = new URLSearchParams({ marketId: String(marketIds[market] || 1) });
  if (params.nodeIdPath) query.set('nodeIdPath', params.nodeIdPath);
  if (params.keyword) query.set('keyword', params.keyword);
  return { endpoint: `https://www.sellersprite.com/v2/competitor-lookup/nodes?${query}`, method: 'GET', metadata: { marketId: marketIds[market] } };
}

function asinDetail(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const query = new URLSearchParams({ station: market, asin: params.asin });
  return { endpoint: `https://www.sellersprite.com/v3/api/asin?${query}`, method: 'GET', metadata: { marketId: marketIds[market] } };
}

function extensionTrendRequest(path, params, extra = {}) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const query = new URLSearchParams({ station: market, asin: params.asin });
  for (const [key, value] of Object.entries(extra)) query.set(key, String(value));
  return {
    endpoint: `https://www.sellersprite.com${path}?${query}`,
    method: 'GET',
    metadata: { marketId: marketIds[market] }
  };
}

function asinOfferTrend(params) {
  return extensionTrendRequest('/v2/extension/chart/coupon-trend', params);
}

function asinSalesTrend(params) {
  return extensionTrendRequest('/v2/extension/competitor-lookup/trend-sales', params);
}

function asinAmzUnitTrend(params) {
  return extensionTrendRequest('/v2/extension/chart/amz-unit-trend', params);
}

function asinKeepaTrend(params) {
  return extensionTrendRequest('/v2/extension/keepa', params, { period: params.period || 'DAY' });
}

function asinDetailOfferTrend(params) {
  return {
    requests: [asinDetail(params), asinKeepaTrend(params)],
    metadata: { composition: ['asin_detail', 'keepa_offer_history'] }
  };
}

function asinCompetitorData(params) {
  return competitorLookup({
    ...params,
    asins: params.asins || (params.asin ? [params.asin] : [])
  });
}

const reverseSortFields = {
  traffic_proportion: 12, traffic: 12, rank_position: 1, rank: 1, ad_rank: 2,
  aba_rank: 4, searches: 5, spr: 16, title_density: 15, purchases: 6,
  purchase_rate: 7, impressions: 25, clicks: 24, products: 8,
  supply_demand_ratio: 9, ad_products: 10, click_concentration: 18,
  conversion_share: 26, bid: 11
};
const minerSortFields = {
  relevancy: 21, aba_rank: 23, search_rank: 23, searches: 5, purchases: 6,
  purchase_rate: 7, impressions: 25, clicks: 24, spr: 16, title_density: 15,
  products: 8, supply_demand_ratio: 9, ad_products: 22, click_share: 18,
  conversion_share: 27, bid: 11, avg_price: 17, ratings: 20, rating: 19
};

function numericSort(value, fields, fallback) {
  if (value == null || value === '') return fallback;
  if (Number.isFinite(Number(value))) return Number(value);
  return fields[value] ?? fallback;
}

function bsrSalesPrediction(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const bsrs = Array.isArray(params.bsrs) ? params.bsrs : [params.bsr];
  const q = bsrs.filter((value) => value != null && value !== '').join(',');
  const query = new URLSearchParams({
    station: marketCodes[market] || market,
    bsrId: String(params.categoryId),
    q
  });
  return {
    endpoint: `https://www.sellersprite.com/v2/extension/competitor-lookup/sales-estimator/bsr?${query}`,
    method: 'GET',
    metadata: { requestedBsr: params.bsr, requestedBsrs: bsrs }
  };
}

function trafficKeyword(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const requestedPage = params.page ?? 1;
  const requestedSize = params.size ?? 50;
  const body = {
    marketplace: marketCodes[market] || market,
    asin: params.asin,
    limit: requestedSize,
    skip: (requestedPage - 1) * requestedSize,
    month: params.month || '',
    badges: params.badges || [],
    conversionKeywordTypes: params.conversionKeywordTypes || [],
    trafficKeywordTypes: params.trafficKeywordTypes || [],
    order: numericSort(params.order?.field, reverseSortFields, 12),
    desc: params.order?.desc ?? true,
    exactly: params.exactly ?? false,
    ac: params.ac ?? false,
    keywordBidMatchType: params.keywordBidMatchType || 'exact',
    filterDeletedKeywords: params.filterDeletedKeywords ?? false
  };
  if (params.keyword != null) body.keyword = params.keyword;
  if (params.includeKeywords != null) body.includeKeywords = params.includeKeywords;
  if (params.excludeKeywords != null) body.excludeKeywords = params.excludeKeywords;
  const query = new URLSearchParams({ asin: params.asin });
  return {
    endpoint: `https://www.sellersprite.com/v2/extension/keyword/reverse/v2/list?${query}`,
    method: 'POST', body,
    metadata: { marketId: marketIds[market], requestedPage, requestedSize }
  };
}

function keywordResearch(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const query = new URLSearchParams({
    station: market,
    marketId: String(marketIds[market] || 1),
    supplement: 'N',
    usestatic: 'R',
    exportGkImages: 'false',
    limitUserStatic: 'true',
    adminDes: 'S',
    presetMode: '',
    itemImageRange: '2',
    keywordBidMatchType: 'exact'
  });
  const direct = [
    'month', 'minSearches', 'maxSearches', 'minProducts', 'maxProducts',
    'minPurchases', 'maxPurchases', 'minPurchaseRate', 'maxPurchaseRate',
    'withYearlyGrowth', 'marketPeriod', 'minAvgPrice', 'maxAvgPrice',
    'minBid', 'maxBid', 'minGoodsValue',
    'maxGoodsValue', 'minSupplyDemandRatio', 'maxSupplyDemandRatio',
    'minWordCount', 'maxWordCount', 'page', 'size'
  ];
  for (const field of direct) if (params[field] != null) query.set(field, String(params[field]));
  const renamed = {
    keywords: 'includeKeywords', excludeKeywords: 'excludeKeywords',
    minSearchesCr: 'minGrowth', maxSearchesCr: 'maxGrowth',
    minSearchMonthCv: 'minYearlyGrowth', maxSearchMonthCv: 'maxYearlyGrowth',
    minSearchMonthCr: 'minYearlyGrowthRate', maxSearchMonthCr: 'maxYearlyGrowthRate',
    minSearchNearlyCv: 'minGrowthTrendMin', maxSearchNearlyCv: 'maxGrowthTrendMin',
    minSearchNearlyCr: 'minGrowthRateTrendMin', maxSearchNearlyCr: 'maxGrowthRateTrendMin',
    minRatings: 'minAvgReviews', maxRatings: 'maxAvgReviews',
    minRating: 'minAvgRating', maxRating: 'maxAvgRating',
    minAraClickRate: 'minMonopolyClickRate', maxAraClickRate: 'maxMonopolyClickRate'
  };
  for (const [source, target] of Object.entries(renamed)) {
    if (params[source] != null) query.set(target, Array.isArray(params[source]) ? params[source].join(',') : String(params[source]));
  }
  for (const [index, department] of (params.departments || []).entries()) query.set(`departments[${index}]`, String(department));
  if (params.order?.field != null) query.set('order.field', String(params.order.field));
  if (params.order?.desc != null) query.set('order.desc', String(params.order.desc));
  return {
    endpoint: `https://www.sellersprite.com/v2/keyword-research?${query}`,
    method: 'GET',
    metadata: {
      marketId: marketIds[market], responseType: 'html',
      requestedPage: params.page ?? 1, requestedSize: params.size ?? 15
    }
  };
}

function keywordResearchTrends(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const keyword = String(params.keyword || '').toLowerCase();
  const query = new URLSearchParams({ q: keyword });
  return {
    endpoint: `https://www.sellersprite.com/v2/extension/keyword/trend/${marketCodes[market] || market}?${query}`,
    method: 'GET', metadata: { marketId: marketIds[market], keyword }
  };
}

function keywordMiner(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const body = {
    marketplace: marketCodes[market] || market,
    keyword: params.keyword,
    keywordList: params.keywordList || [],
    pageNum: params.page ?? 1,
    pageSize: params.size ?? 50,
    historyDate: params.historyDate || '',
    orderBy: numericSort(params.order?.field, minerSortFields, 21),
    desc: params.order?.desc ?? true,
    filterRootWord: params.filterRootWord ?? 0,
    matchType: params.matchType ?? 0,
    amazonChoice: params.amazonChoice ?? false,
    keywordBidMatchType: params.keywordBidMatchType || 'exact'
  };
  const direct = [
    'minSearch', 'maxSearch', 'minPurchases', 'maxPurchases',
    'minPurchasesRate', 'maxPurchasesRate', 'minSPR', 'maxSPR',
    'minTitleDensity', 'maxTitleDensity', 'minRelevancy', 'maxRelevancy',
    'minSearchRank', 'maxSearchRank', 'minProducts', 'maxProducts',
    'minSupplyDemandRatio', 'maxSupplyDemandRatio', 'minAdProducts',
    'maxAdProducts', 'minWordCount', 'maxWordCount', 'minMonopolyClickRate',
    'maxMonopolyClickRate', 'minBid', 'maxBid', 'minPrice', 'maxPrice',
    'minRatings', 'maxRatings', 'minRating', 'maxRating', 'includeKeywords',
    'excludeKeywords'
  ];
  for (const field of direct) if (params[field] != null) body[field] = params[field];
  const query = new URLSearchParams({ q: params.keyword });
  return {
    endpoint: `https://www.sellersprite.com/v2/extension/keyword/mining/v2/list?${query}`,
    method: 'POST', body,
    metadata: { marketId: marketIds[market], requestedPage: body.pageNum, requestedSize: body.pageSize }
  };
}

const trafficExtendFieldMap = {
  minSearches: 'searchesMin', maxSearches: 'searchesMax',
  minSearchRank: 'searchesRankMin', maxSearchRank: 'searchesRankMax',
  minPurchases: 'purchasesMin', maxPurchases: 'purchasesMax',
  minPurchaseRate: 'purchaseRateMin', maxPurchaseRate: 'purchaseRateMax',
  minProducts: 'productsMin', maxProducts: 'productsMax',
  minSupplyDemandRatio: 'supplyDemandRatioMin', maxSupplyDemandRatio: 'supplyDemandRatioMax',
  minBid: 'bidMin', maxBid: 'bidMax', minAdProducts: 'ads7Min', maxAdProducts: 'ads7Max',
  minWordCount: 'minKeywords', maxWordCount: 'maxKeywords',
  minSPR: 'minCprExact', maxSPR: 'maxCprExact',
  minTitleDensity: 'minTitleDensityExact', maxTitleDensity: 'maxTitleDensityExact',
  minMonopolyClickRate: 'minMonopolyClickRate', maxMonopolyClickRate: 'maxMonopolyClickRate',
  minTrafficPercentage: 'minTrafficPercentage', maxTrafficPercentage: 'maxTrafficPercentage',
  minConversionRate: 'minTop3ConversionRate', maxConversionRate: 'maxTop3ConversionRate',
  minCompetitors: 'minCompetitors', maxCompetitors: 'maxCompetitors'
};

function trafficExtend(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const body = {
    market: marketIds[market] || 1,
    month: params.historyDate || '',
    asinList: params.asinList || [],
    originAsinList: params.asinList || [],
    queryVariations: params.queryType ?? 2,
    page: params.page ?? 1,
    size: params.size ?? 50,
    orderColumn: numericSort(params.order?.field, reverseSortFields, 12),
    desc: params.order?.desc ?? true,
    exactly: params.exactly ?? false,
    ac: params.amazonChoice ?? false,
    keywordBidMatchType: params.keywordBidMatchType || 'exact',
    filterDeletedKeywords: params.filterDeletedKeywords ?? false
  };
  for (const [source, target] of Object.entries(trafficExtendFieldMap)) {
    if (params[source] == null) continue;
    const percentField = [
      'minPurchaseRate', 'maxPurchaseRate', 'minMonopolyClickRate', 'maxMonopolyClickRate',
      'minTrafficPercentage', 'maxTrafficPercentage', 'minConversionRate', 'maxConversionRate'
    ].includes(source);
    body[target] = percentField ? Number(params[source]) / 100 : params[source];
  }
  if (params.includeKeywords != null) body.includeKeywords = Array.isArray(params.includeKeywords)
    ? params.includeKeywords : String(params.includeKeywords).split(',').map((value) => value.trim()).filter(Boolean);
  if (params.excludeKeywords != null) body.excludeKeywords = Array.isArray(params.excludeKeywords)
    ? params.excludeKeywords : String(params.excludeKeywords).split(',').map((value) => value.trim()).filter(Boolean);
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/traffic/extend/asin',
    method: 'POST', body,
    metadata: { marketId: body.market, requestedPage: body.page, requestedSize: body.size }
  };
}

const abaSortFields = {
  keyword: 'keyword', searches: 'searches', search_rank: 'searchfrequencyrank',
  rank: 'searchfrequencyrank', impressions: 'impressions', clicks: 'clicks',
  spr: 'cprExact', title_density: 'titleDensityExact'
};

function abaResearch(params, reverseType) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const defaultSize = reverseType === 'W' ? 40 : 15;
  const table = params.date
    ? (String(params.date).startsWith('ara_') ? String(params.date) : `ara_${params.date}`)
    : '';
  const body = {
    market,
    table,
    reverseType,
    q: params.keyword || '',
    departments: params.departments || [],
    rankGrowthType: params.rankGrowthType || 'W1',
    searchModels: params.searchModel ?? '',
    page: params.page ?? 1,
    size: params.size ?? defaultSize,
    order: {
      field: abaSortFields[params.order?.field] || params.order?.field || 'searchfrequencyrank',
      desc: params.order?.desc ?? false
    },
    keywordBidMatchType: params.keywordBidMatchType || 'exact'
  };
  const direct = [
    'rankGrowthValue', 'minRankGrowthRate', 'maxRankGrowthRate',
    'minSearchRank', 'maxSearchRank', 'minSearches', 'maxSearches',
    'minMonopolyClickRate', 'maxMonopolyClickRate', 'minConversionRate', 'maxConversionRate',
    'minWordCount', 'maxWordCount', 'minSPR', 'maxSPR',
    'minTitleDensity', 'maxTitleDensity', 'minClicks', 'maxClicks',
    'minImpressions', 'maxImpressions'
  ];
  for (const field of direct) if (params[field] != null) body[field] = params[field];
  if (params.includeKeywords != null) body.includeKeywords = params.includeKeywords;
  if (params.excludeKeywords != null) body.excludeKeywords = params.excludeKeywords;
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/aba-research',
    method: 'POST', body,
    metadata: { marketId: marketIds[market], reverseType, requestedPage: body.page, requestedSize: body.size }
  };
}

function abaResearchWeekly(params) { return abaResearch(params, 'W'); }
function abaResearchMonthly(params) { return abaResearch(params, 'M'); }

function abaResearchTrends(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const query = new URLSearchParams({
    market,
    keyword: params.keyword,
    interval: String(params.timeGranularity || 'W').toLowerCase()
  });
  if (params.date) query.set('table', String(params.date).startsWith('ara_') ? params.date : `ara_${params.date}`);
  return {
    endpoint: `https://www.sellersprite.com/v3/api/aba-research/trends?${query}`,
    method: 'GET', metadata: { marketId: marketIds[market] }
  };
}

function googleTrends(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const googleProp = params.googleProp || 'web';
  const query = new URLSearchParams({
    station: market,
    keyword: params.keyword,
    gprop: googleProp === 'shoppingCart' ? 'froogle' : '',
    intervalYear: String(params.intervalYear ?? 5),
    gv: 'false',
    monthly: String(params.monthly ?? false)
  });
  return {
    endpoint: `https://www.sellersprite.com/v2/keyword/google-trends.json?${query}`,
    method: 'GET', metadata: { marketId: marketIds[market], googleProp }
  };
}

const keywordOrderConversionTypes = {
  E: 'EXCELLENT', S: 'STABLE', L: 'LOST', I: 'INVALID'
};

function keywordOrder(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const asins = (Array.isArray(params.asins) ? params.asins : [params.asin || params.asins])
    .filter(Boolean).slice(0, 20);
  const requestedPage = params.page ?? 1;
  const requestedSize = params.size ?? 50;
  const makeRequest = (asin) => {
    const body = {
      asin,
      limit: requestedSize,
      skip: (requestedPage - 1) * requestedSize,
      month: params.date || '',
      conversionKeywordTypes: (params.conversionType || []).map(
        (value) => keywordOrderConversionTypes[value] || value
      ),
      trafficKeywordTypes: [],
      badges: [],
      order: numericSort(params.order?.field, reverseSortFields, 12),
      desc: params.order?.desc ?? false,
      exactly: false,
      ac: false,
      keywordBidMatchType: 'exact',
      filterDeletedKeywords: false
    };
    return {
      endpoint: `https://www.sellersprite.com/v3/api/relation/reversing?market=${encodeURIComponent(market)}`,
      method: 'POST', body,
      metadata: { asin, marketId: marketIds[market], requestedPage, requestedSize }
    };
  };
  const requests = asins.map(makeRequest);
  return requests.length === 1
    ? requests[0]
    : { requests, metadata: { composition: 'one web request per ASIN', asins } };
}

function relationTrafficList(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const relations = (params.relations || []).map((value) => String(value).toUpperCase());
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/relation/traffic',
    method: 'POST',
    body: {
      market: marketIds[market] || 1,
      asinList: params.asinList || params.asins || [],
      relations,
      queryVariations: params.variations ?? false,
      pageNum: params.page ?? 1,
      pageSize: params.size ?? 50,
      orderField: params.order?.field || 'createdTime',
      desc: params.order?.desc ?? true
    },
    metadata: { marketId: marketIds[market] || 1 }
  };
}

function trafficKeywordStat(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/relation/stat-keywords',
    method: 'POST',
    body: {
      asin: params.asin,
      marketId: marketIds[market] || 1,
      month: params.month || '',
      forceReStat: false,
      badges: [],
      limit: 50
    },
    metadata: { marketId: marketIds[market] || 1 }
  };
}

function relationTrafficStat(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/relation/multi-stat-traffics',
    method: 'POST',
    body: {
      asinList: params.asinList || params.asins || [],
      station: market,
      queryVariations: false
    },
    metadata: { marketId: marketIds[market] || 1 }
  };
}

const trafficSourceSortFields = {
  keywords: 1,
  natural_searching: 2,
  amazon_choice: 3,
  editorial_recommendations: 4,
  four_star: 5,
  highly_rated: 6,
  sponsor_brand: 7,
  sponsor_video: 8,
  ads: 9,
  asin: 10
};

function trafficSource(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const q = String(params.q || '');
  const defaultOrder = q.toUpperCase().startsWith('B0') ? 1 : 10;
  const query = new URLSearchParams({
    keywordOrAsin: q,
    market,
    pageNo: String(params.page ?? 1),
    pageSize: String(params.size ?? 50),
    order: String(numericSort(params.order?.field, trafficSourceSortFields, defaultOrder)),
    desc: String(params.order?.desc ?? true),
    month: params.month || ''
  });
  return {
    endpoint: `https://www.sellersprite.com/v3/api/relation/ta/source?${query}`,
    method: 'GET', metadata: { marketId: marketIds[market] || 1 }
  };
}

function marketMonth(value, fallback = '210001') {
  if (value == null || value === '' || value === 'bsr_sales_nearly') return fallback;
  return String(value);
}

const marketResearchFieldMap = {
  minAvgUnits: 'minAvgSales', maxAvgUnits: 'maxAvgSales',
  minAvgRevenue: 'minAvgRevenue', maxAvgRevenue: 'maxAvgRevenue',
  minAvgRatings: 'minAvgReviews', maxAvgRatings: 'maxAvgReviews',
  minAvgRating: 'minAvgRating', maxAvgRating: 'maxAvgRating',
  minAvgBsr: 'minAvgBsr', maxAvgBsr: 'maxAvgBsr',
  minAvgPrice: 'minAvgPrice', maxAvgPrice: 'maxAvgPrice',
  minWeight: 'minAvgWeight', maxWeight: 'maxAvgWeight',
  minVolume: 'minAvgVolume', maxVolume: 'maxAvgVolume',
  minAvgProfit: 'minAvgProfit', maxAvgProfit: 'maxAvgProfit',
  minTopAvgUnits: 'minHeadListingAvgSales', maxTopAvgUnits: 'maxHeadListingAvgSales',
  minTopAvgRevenue: 'minHeadListingAvgRevenue', maxTopAvgRevenue: 'maxHeadListingAvgRevenue',
  minTopAvgBsr: 'minHeadListingAvgBsr', maxTopAvgBsr: 'maxHeadListingAvgBsr',
  minGoodsCount: 'minTotalProducts', maxGoodsCount: 'maxTotalProducts',
  minBrands: 'minBrands', maxBrands: 'maxBrands',
  minSellers: 'minSellers', maxSellers: 'maxSellers',
  minAvgSellers: 'minAvgSellers', maxAvgSellers: 'maxAvgSellers',
  minGoodsCrn: 'minHeadListingProductCrn', maxGoodsCrn: 'maxHeadListingProductCrn',
  minBrandCrn: 'minHeadListingBrandCrn', maxBrandCrn: 'maxHeadListingBrandCrn',
  minSellerCrn: 'minHeadListingSellerCrn', maxSellerCrn: 'maxHeadListingSellerCrn',
  minEbcProportion: 'minEbcRatio', maxEbcProportion: 'maxEbcRatio',
  minFbaProportion: 'minFbaRatio', maxFbaProportion: 'maxFbaRatio',
  minFbmProportion: 'minFbmRatio', maxFbmProportion: 'maxFbmRatio',
  minAmazonSelfProportion: 'minAmzRatio', maxAmazonSelfProportion: 'maxAmzRatio',
  minNewProportion: 'minNewRatio', maxNewProportion: 'maxNewRatio',
  minNewCount: 'minNewCount', maxNewCount: 'maxNewCount',
  minNewAvgRatings: 'minNewAvgReviews', maxNewAvgRatings: 'maxNewAvgReviews',
  minNewAvgPrice: 'minNewAvgPrice', maxNewAvgPrice: 'maxNewAvgPrice',
  minNewAvgRating: 'minNewAvgRating', maxNewAvgRating: 'maxNewAvgRating',
  minNewAvgUnits: 'minNewAvgSales', maxNewAvgUnits: 'maxNewAvgSales',
  minNewAvgRevenue: 'minNewAvgRevenue', maxNewAvgRevenue: 'maxNewAvgRevenue'
};

function marketResearch(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const form = {
    marketId: marketIds[market] || 1,
    monthName: params.month || 'bsr_sales_nearly',
    topn: params.topNum ?? params.topN ?? 10,
    newReleaseNum: params.newProduct ?? 6,
    nodeIdPath: params.nodeIdPath || '',
    departmentKeyword: params.departmentKeyword || '',
    sampleNumber: 1,
    tab: 1,
    page: params.page ?? 1,
    size: params.size ?? 50,
    'order.field': params.order?.field || 'total_sales',
    'order.desc': params.order?.desc ?? true
  };
  for (const [source, target] of Object.entries(marketResearchFieldMap)) {
    if (params[source] != null) form[target] = params[source];
  }
  if (params.sellerLocation != null) {
    form.sellerNations = Array.isArray(params.sellerLocation)
      ? params.sellerLocation.join(',') : params.sellerLocation;
  }
  return {
    endpoint: 'https://www.sellersprite.com/v2/market-research',
    method: 'POST', form,
    metadata: { responseType: 'html', htmlParser: 'marketResearch', requestedPage: form.page, requestedSize: form.size }
  };
}

function marketStatistics(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const marketId = marketIds[market] || 1;
  const nodeIdPath = params.nodeIdPath || '';
  const query = new URLSearchParams({
    topN: String(params.topN ?? 10),
    newReleaseNum: String(params.newProduct ?? 6),
    currentMonth: params.month || ''
  });
  return {
    endpoint: `https://www.sellersprite.com/v2/market-research/${marketId}/${encodeURIComponent(nodeIdPath)}?${query}`,
    method: 'GET',
    metadata: { responseType: 'html', htmlParser: 'marketStatistics', marketId, nodeIdPath }
  };
}

function marketReport(params, reportType) {
  const market = String(params.marketplace || 'US').toUpperCase();
  const marketId = marketIds[market] || 1;
  const nodeIdPath = params.nodeIdPath || '';
  const defaultTop = ['PRODUCT', 'BRAND', 'SELLER', 'PERFORMANCE'].includes(reportType) ? 100 : 10;
  const query = new URLSearchParams({
    reportType,
    t: String(params.topN ?? defaultTop),
    nrn: String(params.newProduct ?? (reportType === 'PERFORMANCE' ? 12 : 6)),
    m: marketMonth(params.month)
  });
  if (params.asins != null) query.set('asins', Array.isArray(params.asins) ? params.asins.join(',') : params.asins);
  return {
    endpoint: `https://www.sellersprite.com/v2/market-research/report/${marketId}/${encodeURIComponent(nodeIdPath)}?${query}`,
    method: 'GET', metadata: { marketId, nodeIdPath, reportType }
  };
}

const marketProductConcentration = (params) => marketReport(params, 'PRODUCT');
const marketBrandConcentration = (params) => marketReport(params, 'BRAND');
const marketSellerConcentration = (params) => marketReport(params, 'SELLER');
const marketSellerTypeDistribution = (params) => marketReport(params, 'SELLER_TYPE');
const marketSellerCountryDistribution = (params) => marketReport(params, 'SELLER_NATION');
const marketProductDemandTrend = (params) => marketReport(params, 'PERFORMANCE');
const marketListingDateDistribution = (params) => marketReport(params, 'SHELF_TIME');
const marketListingTrendDistribution = (params) => marketReport(params, 'SHELF_TREND');
const marketRatingsCountDistribution = (params) => marketReport(params, 'REVIEWS');
const marketRatingDistribution = (params) => marketReport(params, 'RATING');
const marketPriceDistribution = (params) => marketReport(params, 'PRICE');
const marketEbcDistribution = (params) => marketReport(params, 'AP_VIDEO');

function review(params) {
  const market = String(params.marketplace || 'US').toUpperCase();
  return {
    endpoint: 'https://www.sellersprite.com/v3/api/review-analysis/comment',
    method: 'POST',
    body: {
      asin: params.asin,
      keyword: params.keyword || '',
      market,
      pageNum: params.page ?? 1,
      pageSize: Math.min(params.size ?? 5, 10),
      reviewStartTime: params.reviewStartTime ?? null,
      reviewEndTime: params.reviewEndTime ?? null,
      order: params.order || { fieldName: 'date', sort: 1 },
      starList: params.starList || [],
      typeList: params.typeList || [],
      variations: params.variations || []
    },
    metadata: { marketId: marketIds[market] || 1 }
  };
}

function tokenTransform(value, seed) {
  function mix(number, pattern) {
    for (let index = 0; index < pattern.length - 2; index += 3) {
      let shift = pattern.charAt(index + 2);
      shift = shift >= 'a' ? shift.charCodeAt(0) - 87 : Number(shift);
      shift = pattern.charAt(index + 1) === '+' ? number >>> shift : number << shift;
      number = pattern.charAt(index) === '+' ? (number + shift) & 0xffffffff : number ^ shift;
    }
    return number;
  }
  const parts = seed.split('.');
  const base = Number(parts[0]) || 0;
  const bytes = [...new TextEncoder().encode(value)];
  let number = base;
  for (const byte of bytes) number = mix(number + byte, '+-a^+6');
  number = mix(number, '+-3^+b+-f') ^ (Number(parts[1]) || 0);
  if (number < 0) number = 0x80000000 + (number & 0x7fffffff);
  const remainder = number % 1_000_000;
  return `${remainder}.${remainder ^ base}`;
}

function sellerSpriteToken(value) {
  const versionSeed = `${extensionVersion.replace(/\./, '00').replace(/\./g, '0')}.1364508470`;
  return tokenTransform(value, versionSeed);
}

let extensionStatePromise;
let extensionAuthToken;
async function readExtensionState() {
  if (!extensionStatePromise) extensionStatePromise = (async () => {
    if (!process.env.SELLERSPRITE_EXTENSION_STATE_JSON) throw new Error('SellerSprite extension CDP state is missing.');
    const state = JSON.parse(process.env.SELLERSPRITE_EXTENSION_STATE_JSON);
    if (!state.token || !state.uuid) throw new Error('SellerSprite extension token or UUID missing in CDP state.');
    extensionAuthToken ||= state.token;
    return { token: state.token, uuid: state.uuid, fingerprint: state.fingerprint || null };
  })();
  return extensionStatePromise;
}

async function authorizeExtensionRequest(item, headers) {
  if (!item.endpoint.includes('/v2/extension/')) return item;
  const state = await readExtensionState();
  const url = new URL(item.endpoint);
  const asin = url.searchParams.get('asin') || url.searchParams.get('asins') || url.searchParams.get('q') || '';
  url.searchParams.set('tk', sellerSpriteToken(asin));
  url.searchParams.set('version', extensionVersion);
  url.searchParams.set('language', 'zh_CN');
  url.searchParams.set('extension', extensionId);
  url.searchParams.set('source', 'chrome');
  headers['Auth-Token'] = extensionAuthToken || state.token;
  headers['Random-Token'] = state.uuid;
  if (state.fingerprint) headers['Auth-FP'] = state.fingerprint;
  return { ...item, endpoint: url.href };
}

async function renewExtensionToken(headers) {
  const state = await readExtensionState();
  const path = '/v2/extension/tk/signin';
  const url = new URL(`https://www.sellersprite.com${path}`);
  url.searchParams.set('tk', sellerSpriteToken(path));
  url.searchParams.set('version', extensionVersion);
  url.searchParams.set('language', 'zh_CN');
  url.searchParams.set('extension', extensionId);
  url.searchParams.set('source', 'chrome');
  const renewalHeaders = {
    ...headers,
    'Auth-Token': extensionAuthToken || state.token,
    'Random-Token': state.uuid
  };
  if (state.fingerprint) renewalHeaders['Auth-FP'] = state.fingerprint;
  const response = await fetch(url, { method: 'GET', headers: renewalHeaders });
  const result = await response.json();
  if (result.code === 'OK' && result.data?.token) {
    extensionAuthToken = result.data.token;
    return true;
  }
  return false;
}

const adapters = {
  competitor_lookup: competitorLookup,
  product_research: productResearch,
  product_node: productNode,
  asin_detail: asinDetail,
  asin_competitor_data: asinCompetitorData,
  asin_offer_trend: asinOfferTrend,
  asin_sales_trend: asinSalesTrend,
  asin_amz_unit_trend: asinAmzUnitTrend,
  asin_keepa_trend: asinKeepaTrend,
  asin_detail_offer_trend: asinDetailOfferTrend,
  bsr_sales_prediction: bsrSalesPrediction,
  traffic_keyword: trafficKeyword,
  keyword_research: keywordResearch,
  keyword_research_trends: keywordResearchTrends,
  keyword_miner: keywordMiner,
  traffic_extend: trafficExtend,
  aba_research_weekly: abaResearchWeekly,
  aba_research_monthly: abaResearchMonthly,
  aba_research_trends: abaResearchTrends,
  google_trends: googleTrends,
  keyword_order: keywordOrder,
  relation_traffic_list: relationTrafficList,
  traffic_keyword_stat: trafficKeywordStat,
  relation_traffic_stat: relationTrafficStat,
  traffic_source: trafficSource,
  market_research: marketResearch,
  market_statistics: marketStatistics,
  market_product_concentration: marketProductConcentration,
  market_brand_concentration: marketBrandConcentration,
  market_seller_country_distribution: marketSellerCountryDistribution,
  market_seller_concentration: marketSellerConcentration,
  market_seller_type_distribution: marketSellerTypeDistribution,
  market_product_demand_trend: marketProductDemandTrend,
  market_listing_date_distribution: marketListingDateDistribution,
  market_listing_trend_distribution: marketListingTrendDistribution,
  market_ratings_count_distribution: marketRatingsCountDistribution,
  market_rating_distribution: marketRatingDistribution,
  market_price_distribution: marketPriceDistribution,
  market_ebc_distribution: marketEbcDistribution,
  review
};
if (!adapters[operation]) throw new Error(`Unknown operation: ${operation}`);
const request = adapters[operation](input);
if (process.env.SELLERSPRITE_DRY_RUN === '1') {
  console.log(JSON.stringify({ operation, request }, null, 2));
  process.exit(0);
}
if (!process.env.SELLERSPRITE_SESSION_JSON) throw new Error('SellerSprite web CDP session is missing.');
const session = JSON.parse(process.env.SELLERSPRITE_SESSION_JSON);
async function execute(item) {
  const expectsHtml = item.metadata?.responseType === 'html';
  const headers = {
      Cookie: session.cookie,
      'User-Agent': session.userAgent,
      Accept: expectsHtml
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        : 'application/json, text/plain, */*'
  };
  if (item.body) headers['Content-Type'] = 'application/json;charset=UTF-8';
  if (item.form) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
  const authorizedItem = await authorizeExtensionRequest(item, headers);
  async function perform() {
    const response = await fetch(authorizedItem.endpoint, {
      method: authorizedItem.method,
      headers,
      ...(authorizedItem.body ? { body: JSON.stringify(authorizedItem.body) } : {}),
      ...(authorizedItem.form ? { body: new URLSearchParams(Object.entries(authorizedItem.form).map(([key, value]) => [key, String(value)])) } : {})
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
      if (expectsHtml) {
        const decode = (value) => value
          .replaceAll('&amp;', '&').replaceAll('&quot;', '"')
          .replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
        const keywords = [];
        const seen = new Set();
        for (const match of text.matchAll(/id="checkbox_t\d+"\s+data-keyword="([^"]+)"/g)) {
          const keyword = decode(match[1]);
          if (!seen.has(keyword)) {
            seen.add(keyword);
            keywords.push({ keyword });
          }
        }
        if (item.metadata?.htmlParser === 'marketResearch') {
          const items = [];
          const seenLinks = new Set();
          for (const match of text.matchAll(/href=["']([^"']*\/v2\/market-research\/(\d+)\/([^?"']+)[^"']*)["']/g)) {
            const href = decode(match[1]);
            if (seenLinks.has(href)) continue;
            seenLinks.add(href);
            items.push({ marketId: Number(match[2]), nodeIdPath: decodeURIComponent(match[3]), detailUrl: new URL(href, 'https://www.sellersprite.com').href });
          }
          data = { code: 'OK', data: { page: Number(item.metadata.requestedPage), size: Number(item.metadata.requestedSize), items }, sourceFormat: 'server-rendered-html', htmlLength: text.length };
        } else if (item.metadata?.htmlParser === 'marketStatistics') {
          const strip = (value) => decode(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
          const statistics = {};
          for (const row of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
            const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => strip(cell[1])).filter(Boolean);
            if (cells.length >= 2) statistics[cells[0]] = cells.slice(1).join(' | ');
          }
          data = { code: 'OK', data: { statistics }, sourceFormat: 'server-rendered-html', htmlLength: text.length };
        } else {
          const requestedSize = Number(item.metadata?.requestedSize || keywords.length);
          data = {
            code: 'OK',
            data: {
              page: Number(item.metadata?.requestedPage || 1),
              size: requestedSize,
              items: keywords.slice(0, requestedSize),
              returnedByPage: keywords.length
            },
            sourceFormat: 'server-rendered-html',
            htmlLength: text.length
          };
        }
      } else data = { raw: text };
    }
    return { response, data };
  }
  let { response, data } = await perform();
  if (authorizedItem.endpoint.includes('/v2/extension/')
      && ['ERR_NEED_RE_AUTHORIZED', 'ERR_NEED_RENEWAL_AUTHORIZED'].includes(data.code)
      && await renewExtensionToken(headers)) {
    headers['Auth-Token'] = extensionAuthToken;
    ({ response, data } = await perform());
  }
  return { request: authorizedItem, status: response.status, result: data };
}

if (request.requests) {
  const responses = await Promise.all(request.requests.map(execute));
  console.log(JSON.stringify({ request, responses }, null, 2));
  process.exit(0);
}

const executed = await execute(request);
const result = executed.result;
if (['competitor_lookup', 'product_research'].includes(operation) && result.data?.items) {
  const { requestedPage, requestedSize, sliceStart } = request.metadata;
  result.data.items = result.data.items.slice(sliceStart, sliceStart + requestedSize);
  result.data.page = requestedPage;
  result.data.size = requestedSize;
}
if (operation === 'keyword_miner' && result.data?.items) {
  const { requestedPage, requestedSize } = request.metadata;
  result.data.items = result.data.items.slice(0, requestedSize);
  result.data.page = requestedPage;
  result.data.size = requestedSize;
}
if (['aba_research_weekly', 'aba_research_monthly'].includes(operation) && result.data?.items) {
  const { requestedPage, requestedSize } = request.metadata;
  result.data.items = result.data.items.slice(0, requestedSize);
  result.data.page = requestedPage;
  result.data.size = requestedSize;
}
console.log(JSON.stringify({ request: { ...request, endpoint: request.endpoint }, status: executed.status, result }, null, 2));
