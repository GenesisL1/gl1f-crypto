/* GL1F Crypto market engine (MIT): the signal code the studio runs, for the Web3 API. */
var GL1F_WORLD=(()=>{var ge=Object.defineProperty;var Le=Object.getOwnPropertyDescriptor;var $e=Object.getOwnPropertyNames;var je=Object.prototype.hasOwnProperty;var Be=(t,e)=>{for(var o in e)ge(t,o,{get:e[o],enumerable:!0})},Ye=(t,e,o,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let l of $e(e))!je.call(t,l)&&l!==o&&ge(t,l,{get:()=>e[l],enumerable:!(i=Le(e,l))||i.enumerable});return t};var qe=t=>Ye(ge({},"__esModule",{value:!0}),t);var ht={};Be(ht,{FOMC_DECISIONS:()=>ue,LIST_SINCE:()=>Oe,LUNAR_NEW_YEAR:()=>Te,SOURCES:()=>$,WAR_ESCALATIONS:()=>Fe,WORLD_ELECTIONS:()=>Ae,WORLD_FEATURES:()=>We,WORLD_META:()=>z,addWorldFeatures:()=>mt,fetchLiveWorld:()=>xe,geocentricLongitude:()=>he,hasWorldKey:()=>de,historyStart:()=>me,isRetrograde:()=>Re,mergeWorldKey:()=>Ue,moonElongation:()=>G,sunLongitude:()=>De,usMarketHolidays:()=>He,worldAvailability:()=>st});var ae=t=>{let e=String(t).trim();return Math.floor(Date.parse(e.length===7?`${e}-01T00:00:00Z`:e.length===10?`${e}T00:00:00Z`:e)/864e5)},te=t=>new Date(t*864e5).toISOString().slice(0,10),Ee=t=>te(t).replace(/-/g,""),L="https://raw.githubusercontent.com/datasets",ce="https://api.db.nomics.world/v22/series",Ke="https://earthquake.usgs.gov/fdsnws/event/1/query",Ge="https://eonet.gsfc.nasa.gov/api/v3/events",Ve="https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user",$={US10Y:{since:"1962-01-02",via:"DBnomics",what:"Federal Reserve H.15, 10-year Treasury",url:`${ce}/FED/H15/RIFLGFCY10_N.B?observations=1`},US2Y:{since:"1976-06-01",via:"DBnomics",what:"Federal Reserve H.15, 2-year Treasury",url:`${ce}/FED/H15/RIFLGFCY02_N.B?observations=1`},FEDFUNDS:{since:"1954-07-01",via:"DBnomics",what:"Federal Reserve H.15, effective federal funds rate",url:`${ce}/FED/H15/RIFSPFF_N.B?observations=1`},UNRATE:{since:"1948-01-01",via:"DBnomics",what:"BLS unemployment rate",url:`${ce}/BLS/ln/LNS14000000?observations=1`},WTI:{since:"1986-01-02",via:"DataHub",what:"EIA WTI spot price",url:`${L}/oil-prices/main/data/wti-daily.csv`,col:"Price"},BRENT:{since:"1987-05-20",via:"DataHub",what:"EIA Brent spot price",url:`${L}/oil-prices/main/data/brent-daily.csv`,col:"Price"},NATGAS:{since:"1997-01-07",via:"DataHub",what:"EIA Henry Hub natural gas spot price",url:`${L}/natural-gas/main/data/daily.csv`,col:"Price"},VIX:{since:"1990-01-02",via:"DataHub",what:"Cboe VIX daily close",url:`${L}/finance-vix/main/data/vix-daily.csv`,col:"CLOSE",licensed:!0},CPI:{since:"1913-01-01",via:"DataHub",what:"BLS CPI-U index",url:`${L}/cpi-us/main/data/cpiai.csv`,col:"Index"},SP500M:{since:"1871-01-01",via:"DataHub",what:"S&P 500 monthly average (Robert Shiller)",url:`${L}/s-and-p-500/main/data/data.csv`,col:"SP500",licensed:!0},GOLDM:{since:"1833-01-01",via:"DataHub",what:"gold monthly price",url:`${L}/gold-prices/main/data/monthly.csv`,col:"Price"},DOLLAR:{since:"1999-01-04",via:"DataHub",what:"Federal Reserve H.10 exchange rates, combined with DXY weights",url:`${L}/exchange-rates/main/data/daily.csv`},QUAKES:{since:"1973-01-01",via:"USGS",what:"earthquakes of magnitude 6 and above"},EONET:{since:"2000-01-01",via:"NASA EONET",what:"tropical storms, tracked since 2000"},WARVIEWS:{since:"2015-07-01",via:"Wikipedia",what:"daily views of War, World War III and Nuclear warfare"}},le={QUAKES:["quakes"],EONET:["storms"],WARVIEWS:["warViews"]},be=t=>String(t).replace(/\r/g,"").split(`
`).filter(e=>e.trim()&&!e.startsWith("#"));function Je(t,e){let[o,...i]=be(t),l=o.split(",").map(g=>g.trim().toLowerCase()),c=l.indexOf(e.toLowerCase());if(c<0)throw new Error(`column ${e} missing`);let h=[];for(let g of i){let D=g.split(","),y=(D[c]||"").trim(),w=ae(D[0]),v=Number(y);y&&Number.isFinite(w)&&Number.isFinite(v)&&!(e==="SP500"&&v===0)&&h.push([w,v])}if(!h.length)throw new Error("no rows");return h.sort((g,D)=>g[0]-D[0])}var Xe={Euro:.576,Japan:.136,"United Kingdom":.119,Canada:.091,Sweden:.042,Switzerland:.036};function ze(t){let e=new Map;for(let i of be(t).slice(1)){let[l,c,h]=i.split(","),g=Xe[c],D=Number(h);if(g===void 0||!(D>0))continue;let y=ae(l),w=e.get(y)||{n:0,log:0};w.n++,w.log+=g*Math.log(D),e.set(y,w)}let o=[...e.entries()].filter(([,i])=>i.n===6).map(([i,l])=>[i,Math.round(50.14348112*Math.exp(l.log)*1e3)/1e3]).sort((i,l)=>i[0]-l[0]);if(!o.length)throw new Error("no complete days");return o}function Qe(t){let e=t?.series?.docs?.[0];if(!e)throw new Error("no series in the response");let o=e.period_start_day||e.period||[],i=e.value||[],l=[];for(let c=0;c<i.length;c++){let h=Number(i[c]);i[c]!=="NA"&&i[c]!==null&&Number.isFinite(h)&&l.push([ae(String(o[c]).slice(0,10)),h])}if(!l.length)throw new Error("no observations");return l.sort((c,h)=>c[0]-h[0])}var Ze=t=>(t?.features||[]).map(e=>[Number(e.properties?.time),Number(e.properties?.mag)]).filter(([e,o])=>Number.isFinite(e)&&Number.isFinite(o)).sort((e,o)=>e[0]-o[0]);function et(t){let e=[],o=new Set;for(let i of t)for(let l of i?.events||[]){if(o.has(l.id)||l.categories?.[0]?.id!=="severeStorms")continue;o.add(l.id);let c=new Map;for(let g of l.geometry||[]){let D=ae(String(g.date).slice(0,10)),y=/kt/i.test(String(g.magnitudeUnit||""))&&Number(g.magnitudeValue)||0;Number.isFinite(D)&&c.set(D,Math.max(c.get(D)||0,y))}if(!c.size)continue;let h=[...c.entries()].sort((g,D)=>g[0]-D[0]);e.push([h[0][0],h[h.length-1][0],h])}return e.sort((i,l)=>i[0]-l[0])}function tt(t){let e=new Map;for(let o of t)for(let i of o?.items||[]){let l=String(i.timestamp),c=ae(`${l.slice(0,4)}-${l.slice(4,6)}-${l.slice(6,8)}`);Number.isFinite(c)&&e.set(c,(e.get(c)||0)+Number(i.views||0))}return[...e.entries()].sort((o,i)=>o[0]-i[0])}var at=["War","World_War_III","Nuclear_warfare"];async function xe({keys:t,fromDay:e,toDay:o,fetchImpl:i=globalThis.fetch,cache:l=new Map}){let c={series:{},quakes:[],storms:[],warViews:[],sources:{}},h={},g=(y,w)=>{let v=`${w}:${y}`;return l.has(v)||l.set(v,(async()=>{let b=await i(y);if(!b.ok)throw new Error(`HTTP ${b.status}`);return w==="json"?b.json():b.text()})().catch(b=>{throw l.delete(v),b})),l.get(v)},D={QUAKES:async()=>{c.quakes=Ze(await g(`${Ke}?format=geojson&starttime=${te(e-31)}&endtime=${te(o+1)}&minmagnitude=6&orderby=time-asc`,"json"))},EONET:async()=>{c.storms=et([await g(`${Ge}?status=all&category=severeStorms&start=${te(e-40)}&end=${te(o+1)}&limit=5000`,"json")])},WARVIEWS:async()=>{c.warViews=tt(await Promise.all(at.map(y=>g(`${Ve}/${y}/daily/${Ee(e-100)}00/${Ee(o)}00`,"json"))))}};return await Promise.all([...new Set(t)].map(async y=>{let w=$[y];if(w)try{D[y]?await D[y]():w.via==="DBnomics"?c.series[y]=Qe(await g(w.url,"json")):c.series[y]=y==="DOLLAR"?ze(await g(w.url,"text")):Je(await g(w.url,"text"),w.col),c.sources[y]=w.via}catch(v){h[y]=`${w.via} (${w.what}): ${v?.message==="Failed to fetch"||v?.name==="TypeError"?"this browser could not reach it":v?.message||v}`}})),{world:c,errors:h}}function de(t,e){return t?le[e]?!!t.sources?.[e]&&le[e].every(o=>Array.isArray(t[o])):Array.isArray(t.series?.[e])&&t.series[e].length>0:!1}function Ue(t,e,o){if(le[o])for(let i of le[o])t[i]=e[i];else t.series[o]=e.series[o];t.sources[o]=`${e.sources?.[o]||$[o]?.via||o}, published copy`}var T=864e5,U=t=>Math.floor(t/T),ye=t=>U(Date.parse(`${t}T00:00:00Z`)),H=t=>t*Math.PI/180,Ne=t=>t*180/Math.PI,J=t=>(t%360+360)%360,ue=`2014-01-29 2014-03-19 2014-04-30 2014-06-18 2014-07-30 2014-09-17 2014-10-29 2014-12-17 2015-01-28 2015-03-18 2015-04-29 2015-06-17
2015-07-29 2015-09-17 2015-10-28 2015-12-16 2016-01-27 2016-03-16 2016-04-27 2016-06-15 2016-07-27 2016-09-21 2016-11-02 2016-12-14
2017-02-01 2017-03-15 2017-05-03 2017-06-14 2017-07-26 2017-09-20 2017-11-01 2017-12-13 2018-01-31 2018-03-21 2018-05-02 2018-06-13
2018-08-01 2018-09-26 2018-11-08 2018-12-19 2019-01-30 2019-03-20 2019-05-01 2019-06-19 2019-07-31 2019-09-18 2019-10-30 2019-12-11
2020-01-29 2020-03-03 2020-03-15 2020-04-29 2020-06-10 2020-07-29 2020-09-16 2020-11-05 2020-12-16 2021-01-27 2021-03-17 2021-04-28
2021-06-16 2021-07-28 2021-09-22 2021-11-03 2021-12-15 2022-01-26 2022-03-16 2022-05-04 2022-06-15 2022-07-27 2022-09-21 2022-11-02
2022-12-14 2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13 2024-01-31 2024-03-20 2024-05-01
2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18 2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29
2025-12-10 2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09`.split(/\s+/).map(ye),Te=`2014-01-31 2015-02-19 2016-02-08 2017-01-28 2018-02-16 2019-02-05 2020-01-25 2021-02-12 2022-02-01 2023-01-22
2024-02-10 2025-01-29 2026-02-17 2027-02-06 2028-01-26 2029-02-13 2030-02-03`.split(/\s+/).map(ye),Ae=[["2014-05-16","India: general election results"],["2014-10-26","Brazil: presidential run-off"],["2014-12-14","Japan: general election"],["2015-05-07","United Kingdom: general election"],["2016-06-23","United Kingdom: EU referendum"],["2017-05-07","France: presidential run-off"],["2017-09-24","Germany: federal election"],["2018-07-01","Mexico: general election"],["2018-10-28","Brazil: presidential run-off"],["2019-05-23","India: general election results"],["2019-12-12","United Kingdom: general election"],["2020-01-11","Taiwan: presidential election"],["2021-09-26","Germany: federal election"],["2022-03-09","South Korea: presidential election"],["2022-04-24","France: presidential run-off"],["2022-10-30","Brazil: presidential run-off"],["2023-05-28","Turkey: presidential run-off"],["2024-01-13","Taiwan: presidential election"],["2024-06-02","Mexico: general election"],["2024-06-04","India: general election results"],["2024-06-09","European Union: parliament election"],["2024-07-04","United Kingdom: general election"],["2024-10-27","Japan: general election"],["2025-02-23","Germany: federal election"],["2025-06-03","South Korea: presidential election"]].map(([t,e])=>[ye(t),e]),Fe=[["2014-02-27","Russia seizes Crimea"],["2020-01-03","US strike kills Iran's Qasem Soleimani"],["2022-02-24","Russia's full-scale invasion of Ukraine"],["2023-10-07","Hamas attacks Israel; Israel-Hamas war"],["2024-04-13","Iran's drone and missile attack on Israel"],["2024-10-01","Iran's ballistic missile attack on Israel"],["2025-05-07","India strikes Pakistan"],["2025-06-13","Israel strikes Iran; twelve-day war"],["2025-06-22","US strikes Iran's nuclear sites"]].map(([t,e])=>[ye(t),e]),M="Holidays & events",N="Astronomy",E="Macro & markets",O="Disasters & conflict",Ce=[["cal_us_holiday","US market holiday",M,"1 on New York Stock Exchange holidays (US Eastern date).",[]],["cal_us_holiday_eve","Day before a US market holiday",M,"1 on the trading day before an NYSE holiday.",[]],["cal_days_to_us_holiday","Days to the next US market holiday",M,"Calendar days, capped at 30.",[]],["cal_fomc_day","Fed decision day (FOMC)",M,"1 on the day the Federal Reserve announces its rate decision.",[]],["cal_days_to_fomc","Days to the next Fed decision",M,"Calendar days to the next FOMC decision, capped at 60.",[]],["cal_days_since_fomc","Days since the last Fed decision",M,"Calendar days since the last FOMC decision, capped at 60.",[]],["cal_us_election_week","US election week",M,"1 within 3 days of a US federal election day (even years).",[]],["cal_days_to_us_election","Days to the next US election",M,"Calendar days to the next US federal election day, capped at 365.",[]],["cal_world_election_week","Major election week worldwide",M,"1 within 3 days of a major election (UK, EU, France, Germany, India, Japan, Korea, Taiwan, Brazil, Mexico, Turkey).",[]],["cal_lunar_new_year","Lunar New Year holidays",M,"1 from 2 days before to 6 days after Lunar New Year (China, Hong Kong, Singapore, Korea, Vietnam).",[]],["cal_china_golden_week","China Golden Week",M,"1 from 1 to 7 October.",[]],["cal_japan_golden_week","Japan Golden Week",M,"1 from 29 April to 5 May.",[]],["cal_asia_holiday","Major Asian holiday",M,"1 during Lunar New Year, China or Japan Golden Week, or Japan's New Year (1 to 3 January).",[]],["cal_christmas_new_year","Christmas to New Year",M,"1 from 24 December to 1 January.",[]],["cal_options_expiry","Monthly options expiry",M,"1 on the third Friday of the month.",[]],["cal_quarterly_expiry","Quarterly expiry (triple witching)",M,"1 on the third Friday of March, June, September and December.",[]],["cal_us_jobs_day","US jobs report day",M,"1 on the first Friday of the month, the usual US jobs report day.",[]],["cal_days_to_month_end","Days to month end",M,"Calendar days to the last day of the month.",[]],["cal_days_to_quarter_end","Days to quarter end",M,"Calendar days to the last day of the quarter.",[]],["cal_year_sin","Season of the year (sine)",M,"Day of the year on a circle.",[]],["cal_year_cos","Season of the year (cosine)",M,"Day of the year on a circle.",[]],["cal_us_dst","US daylight saving time",M,"1 while US clocks are on daylight saving time.",[]],["astro_moon_phase","Moon phase",N,"0 at new moon, 0.5 at full moon, back to 1 at the next new moon.",[]],["astro_moon_illumination","Moon illumination",N,"Lit fraction of the Moon, 0 to 1.",[]],["astro_days_to_full_moon","Days to the next full moon",N,"Days, 0 to about 29.5.",[]],["astro_days_to_new_moon","Days to the next new moon",N,"Days, 0 to about 29.5.",[]],["astro_full_moon","Full moon",N,"1 within a day of full moon.",[]],["astro_new_moon","New moon",N,"1 within a day of new moon.",[]],["astro_mercury_retrograde","Mercury retrograde",N,"1 while Mercury appears to move backwards against the stars, seen from Earth.",[]],["astro_venus_retrograde","Venus retrograde",N,"1 while Venus appears to move backwards, seen from Earth.",[]],["astro_mars_retrograde","Mars retrograde",N,"1 while Mars appears to move backwards, seen from Earth.",[]],["astro_retrograde_count","Planets in retrograde",N,"How many of Mercury, Venus, Mars, Jupiter and Saturn appear to move backwards.",[]],["astro_planet_spread","Planetary alignment",N,"Smallest arc of sky holding Mercury to Saturn, as a share of the full circle: lower means more aligned.",[]],["astro_days_to_season","Days to the next equinox or solstice",N,"Days to the nearest equinox or solstice (Sun's position).",[]],["mkt_us10y","US 10-year Treasury yield",E,"Percent, as published 2 days earlier (Federal Reserve H.15 via DBnomics).",["US10Y"]],["mkt_us10y_chg_20d","US 10-year yield, 20-day change",E,"Percentage points over 20 trading days (Federal Reserve H.15 via DBnomics).",["US10Y"]],["mkt_us2y","US 2-year Treasury yield",E,"Percent (Federal Reserve H.15 via DBnomics).",["US2Y"]],["mkt_yield_curve","Yield curve (10-year minus 2-year)",E,"Percentage points; negative means an inverted curve (Federal Reserve H.15 via DBnomics).",["US10Y","US2Y"]],["mkt_fed_funds","Fed funds rate",E,"Effective federal funds rate, percent (Federal Reserve H.15 via DBnomics).",["FEDFUNDS"]],["mkt_fed_funds_chg_90d","Fed funds rate, 90-day change",E,"Percentage points over 90 days: hikes positive, cuts negative (Federal Reserve H.15 via DBnomics).",["FEDFUNDS"]],["mkt_wti_ret_5d","Oil (WTI), 5-day change",E,"Percent change of the WTI spot price over 5 trading days (EIA via DataHub).",["WTI"]],["mkt_wti_ret_20d","Oil (WTI), 20-day change",E,"Percent change over 20 trading days (EIA via DataHub).",["WTI"]],["mkt_brent_ret_5d","Oil (Brent), 5-day change",E,"Percent change of the Brent spot price over 5 trading days (EIA via DataHub).",["BRENT"]],["mkt_natgas_ret_5d","Natural gas, 5-day change",E,"Percent change of the Henry Hub spot price over 5 trading days (EIA via DataHub).",["NATGAS"]],["mkt_dollar_ret_20d","US dollar index, 20-day change",E,"Percent change over 20 trading days of the dollar index (DXY weights) built from Federal Reserve H.10 exchange rates (via DataHub).",["DOLLAR"]],["mkt_vix","VIX volatility index",E,"Daily close, as published 2 days earlier (Cboe via DataHub).",["VIX"]],["mkt_vix_chg_5d","VIX, 5-day change",E,"Points over 5 trading days (Cboe via DataHub).",["VIX"]],["mkt_spx_ret_1m","S&P 500, last month's change",E,"Percent change of the monthly average, counted from 40 days after the month (Robert Shiller's data via DataHub).",["SP500M"]],["mkt_spx_drawdown_12m","S&P 500 below its 12-month high",E,"Percent below the highest monthly average of the last 12 months (Shiller via DataHub).",["SP500M"]],["mkt_gold_ret_1m","Gold, last month's change",E,"Percent change of the monthly gold price, counted from 40 days after the month (via DataHub).",["GOLDM"]],["macro_cpi_yoy","US inflation (CPI, year over year)",E,"Percent, counted from 45 days after the month it measures (BLS CPI-U via DataHub).",["CPI"]],["macro_unemployment","US unemployment rate",E,"Percent, counted from 40 days after the month it measures (BLS via DBnomics).",["UNRATE"]],["event_quakes_m6_7d","Strong earthquakes (M6+), last 7 days",O,"Count worldwide (USGS).",["QUAKES"]],["event_quake_max_7d","Largest earthquake, last 7 days",O,"Highest magnitude of M6+ earthquakes worldwide, 0 if none (USGS).",["QUAKES"]],["event_quakes_m7_30d","Major earthquakes (M7+), last 30 days",O,"Count worldwide (USGS).",["QUAKES"]],["event_storms_active","Active hurricanes, typhoons and cyclones",O,"Tropical storms tracked the day before (NASA EONET).",["EONET"]],["event_storm_wind_max","Strongest active storm (wind)",O,"Highest wind reported the day before among active tropical storms, in knots; 0 if none (NASA EONET).",["EONET"]],["event_major_storms_active","Major hurricanes and typhoons",O,"Tropical storms with winds of 96 knots or more the day before: category 3 or stronger (NASA EONET).",["EONET"]],["event_new_storms_7d","New tropical storms, last 7 days",O,"Tropical storms first tracked in the last 7 days (NASA EONET).",["EONET"]],["event_war_attention","War attention",O,"Wikipedia views of War, World War III and Nuclear warfare the day before, versus their 90-day average.",["WARVIEWS"]],["event_days_since_war_escalation","Days since a major war escalation",O,"Days since the latest major escalation in the built-in list, capped at 365.",[]],["event_war_escalation_week","Week after a major war escalation",O,"1 during the 7 days after a major escalation (Ukraine, Israel and Gaza, Iran, India and Pakistan).",[]]],Oe="2014-02-01",rt=new Set(["cal_fomc_day","cal_days_to_fomc","cal_days_since_fomc","cal_world_election_week","cal_lunar_new_year","cal_asia_holiday","event_days_since_war_escalation","event_war_escalation_week"]),nt=(t,e)=>t.length?t.map(o=>$[o].since).sort().pop():rt.has(e)?Oe:null,z=Object.fromEntries(Ce.map(([t,e,o,i,l])=>{let c=nt(l,t);return[t,{label:e,group:o,needs:l,since:c,note:c?`${i} History from ${c.slice(0,4)}.`:i}]})),ot={mkt_us10y_chg_20d:35,mkt_fed_funds_chg_90d:100,mkt_wti_ret_5d:14,mkt_wti_ret_20d:35,mkt_brent_ret_5d:14,mkt_natgas_ret_5d:14,mkt_dollar_ret_20d:35,mkt_vix_chg_5d:14,mkt_spx_ret_1m:80,mkt_spx_drawdown_12m:420,mkt_gold_ret_1m:80,macro_cpi_yoy:420,macro_unemployment:45,event_quakes_m6_7d:8,event_quake_max_7d:8,event_quakes_m7_30d:31,event_war_attention:100,event_new_storms_7d:8},me=t=>{let e=z[t]?.since;return e?U(Date.parse(`${e}T00:00:00Z`))+(ot[t]??3):null},We=Ce.map(t=>t[0]);function st(t){return t.map(e=>{let o=z[e.name]?.needs;return o?.length?{...e,available:!0,requires:`live public data: ${[...new Set(o.map(i=>$[i].via))].join(", ")}`}:e})}function it(t){let e=t%19,o=Math.floor(t/100),i=t%100,l=Math.floor(o/4),c=o%4,h=Math.floor((o+8)/25),g=Math.floor((o-h+1)/3),D=(19*e+o-l-g+15)%30,y=Math.floor(i/4),w=i%4,v=(32+2*c+2*y-D-w)%7,b=Math.floor((e+11*D+22*v)/451);return U(Date.UTC(t,Math.floor((D+v-7*b+114)/31)-1,(D+v-7*b+114)%31+1))}var C=t=>new Date(t*T).getUTCDay();function V(t,e,o,i){let l=C(U(Date.UTC(t,e,1)));return U(Date.UTC(t,e,1))+(o-l+7)%7+7*(i-1)}function ct(t,e,o){let i=U(Date.UTC(t,e+1,0));return i-(C(i)-o+7)%7}function He(t){let e=(c,h)=>U(Date.UTC(t,c,h)),o=c=>C(c)===6?c-1:C(c)===0?c+1:c,i=[],l=e(0,1);return C(l)===0?i.push(l+1):C(l)!==6&&i.push(l),i.push(V(t,0,1,3),V(t,1,1,3),it(t)-2,ct(t,4,1)),t>=2022&&i.push(o(e(5,19))),i.push(o(e(6,4)),V(t,8,1,1),V(t,10,4,4),o(e(11,25))),i.sort((c,h)=>c-h)}var lt=t=>V(t,10,1,1)+1;function dt(t){let e=new Date(t).getUTCFullYear(),o=V(e,2,0,2)*T+7*36e5,i=V(e,10,0,1)*T+6*36e5;return t>=o&&t<i?1:0}var ve=(t,e)=>{for(let o of t)if(o>=e)return o;return null},Ie=(t,e)=>{let o=null;for(let i of t){if(i>e)break;o=i}return o},_t={mercury:[[.38709927,.20563593,7.00497902,252.2503235,77.45779628,48.33076593],[37e-8,1906e-8,-.00594749,149472.67411175,.16047689,-.12534081]],venus:[[.72333566,.00677672,3.39467605,181.9790995,131.60246718,76.67984255],[39e-7,-4107e-8,-7889e-7,58517.81538729,.00268329,-.27769418]],earth:[[1.00000261,.01671123,-1531e-8,100.46457166,102.93768193,0],[562e-8,-4392e-8,-.01294668,35999.37244981,.32327364,0]],mars:[[1.52371034,.0933941,1.84969142,-4.55343205,-23.94362959,49.55953891],[1847e-8,7882e-8,-.00813131,19140.30268499,.44441088,-.29257343]],jupiter:[[5.202887,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-11607e-8,-13253e-8,-.00183714,3034.74612775,.21252668,.20469106]],saturn:[[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-.0012506,-50991e-8,.00193609,1222.49362201,-.41897216,-.28867794]]},Pe=t=>(t/T+24405875e-1-2451545)/36525;function Se(t,e){let[o,i]=_t[t],l=o[0]+i[0]*e,c=o[1]+i[1]*e,h=H(o[2]+i[2]*e),g=o[3]+i[3]*e,D=o[4]+i[4]*e,y=o[5]+i[5]*e,w=H(J(g-D+180)-180),v=H(D-y),b=H(y),P=w+c*Math.sin(w);for(let oe=0;oe<8;oe++)P-=(P-c*Math.sin(P)-w)/(1-c*Math.cos(P));let Q=l*(Math.cos(P)-c),Z=l*Math.sqrt(1-c*c)*Math.sin(P),A=Math.cos(v),W=Math.sin(v),j=Math.cos(b),B=Math.sin(b),Y=Math.cos(h);return[(A*j-W*B*Y)*Q+(-W*j-A*B*Y)*Z,(A*B+W*j*Y)*Q+(-W*B+A*j*Y)*Z]}function he(t,e){let o=Pe(e),i=Se(t,o),l=Se("earth",o);return J(Ne(Math.atan2(i[1]-l[1],i[0]-l[0])))}function De(t){let e=Se("earth",Pe(t));return J(Ne(Math.atan2(-e[1],-e[0])))}function Re(t,e){let o=he(t,e+T/2)-he(t,e-T/2);return J(o+180)-180<0}function G(t){let e=t/T+24405875e-1-2451545,o=218.316+13.176396*e,i=H(134.963+13.064993*e),l=H(297.85+12.190749*e),c=H(357.529+.98560028*e),h=H(93.272+13.22935*e),g=o+6.289*Math.sin(i)+1.274*Math.sin(2*l-i)+.658*Math.sin(2*l)+.214*Math.sin(2*i)-.186*Math.sin(c)-.114*Math.sin(2*h);return J(g-De(t))}var _e=29.530588853;function ut(t,e){let o=t?.series?.[e];return!Array.isArray(o)||!o.length?null:{day:Int32Array.from(o,i=>i[0]),val:Float64Array.from(o,i=>i[1])}}function re(t,e){let o=0,i=t.day.length-1,l=-1;for(;o<=i;){let c=o+i>>1;t.day[c]<=e?(l=c,o=c+1):i=c-1}return l}var ne=(t,e)=>Number.isFinite(t)&&Number.isFinite(e)&&e!==0?100*(t-e)/Math.abs(e):0;async function mt(t,e,o,i){let l=We.filter(r=>t.wants(r));if(!l.length)return;let c=e.length,h=new Float64Array(c);for(let r=0;r<c;r++)h[r]=Number(e[r])+o*6e4;let g=r=>{let a=new Float64Array(c);for(let s=0;s<c;s++)a[s]=r(s,h[s],U(h[s]));return a},D=U(h[0]),y=l.filter(r=>me(r)!==null&&D<me(r));if(y.length){let r=new Date(Math.max(...y.map(me))*T).toISOString().slice(0,10);throw new Error(`Not enough history for ${y.map(a=>`${z[a].label} (data from ${z[a].since.slice(0,7)})`).join(", ")}: start the dataset on or after ${r}, or deselect ${y.length===1?"it":"them"}.`)}let w=[...new Set(l.flatMap(r=>z[r].needs))],v=w.length?await i({keys:w,fromDay:U(h[0]),toDay:U(h[c-1])}):null;if(w.length){let r=w.filter(a=>!de(v,a));if(r.length)throw new Error(`Could not load public data in this browser: ${[...new Set(r.map(a=>v?.errors?.[a]||$[a]?.via||a))].join("; ")}. Check the connection and try again, or deselect those world signals.`)}let b=r=>l.includes(r),P=[...new Set(Array.from(h,r=>new Date(r).getUTCFullYear()))].flatMap(r=>[r-1,r,r+1]),Q=[...new Set(P)].sort(),Z=[...new Set(Q.flatMap(He))].sort((r,a)=>r-a),A=new Set(Z),W=r=>U(r-5*36e5),j=r=>{let a=r+1;for(;C(a)===0||C(a)===6||A.has(a);)a++;return a},B=Q.filter(r=>r%2===0).map(lt).sort((r,a)=>r-a),Y=Te,oe=Ae.map(r=>r[0]),ke=Fe.map(r=>r[0]),se=(r,a,s,_)=>r.some(k=>a>=k-s&&a<=k+_)?1:0,R=r=>{let a=new Date(r);return[a.getUTCMonth(),a.getUTCDate(),a.getUTCFullYear()]},Me=r=>{let a=new Date(r);return a.getUTCDay()===5&&a.getUTCDate()>=15&&a.getUTCDate()<=21},F={cal_us_holiday:(r,a)=>A.has(W(a))?1:0,cal_us_holiday_eve:(r,a)=>{let s=W(a);return C(s)!==0&&C(s)!==6&&!A.has(s)&&A.has(s+1)||A.has(j(s)-1)&&j(s)-s>1&&C(s)===5&&A.has(s+3)?1:0},cal_days_to_us_holiday:(r,a)=>{let s=ve(Z,W(a));return s===null?30:Math.min(30,s-W(a))},cal_fomc_day:(r,a,s)=>ue.includes(s)?1:0,cal_days_to_fomc:(r,a,s)=>{let _=ve(ue,s);return _===null?60:Math.min(60,_-s)},cal_days_since_fomc:(r,a,s)=>{let _=Ie(ue,s);return _===null?60:Math.min(60,s-_)},cal_us_election_week:(r,a,s)=>se(B,s,3,3),cal_days_to_us_election:(r,a,s)=>{let _=ve(B,s);return _===null?365:Math.min(365,_-s)},cal_world_election_week:(r,a,s)=>se(oe,s,3,3),cal_lunar_new_year:(r,a,s)=>se(Y,s,2,6),cal_china_golden_week:(r,a)=>{let[s,_]=R(a);return s===9&&_<=7?1:0},cal_japan_golden_week:(r,a)=>{let[s,_]=R(a);return s===3&&_>=29||s===4&&_<=5?1:0},cal_asia_holiday:(r,a,s)=>{let[_,k]=R(a);return se(Y,s,2,6)||_===9&&k<=7||_===3&&k>=29||_===4&&k<=5||_===0&&k<=3?1:0},cal_christmas_new_year:(r,a)=>{let[s,_]=R(a);return s===11&&_>=24||s===0&&_===1?1:0},cal_options_expiry:(r,a)=>Me(a)?1:0,cal_quarterly_expiry:(r,a)=>Me(a)&&[2,5,8,11].includes(new Date(a).getUTCMonth())?1:0,cal_us_jobs_day:(r,a)=>{let s=new Date(a);return s.getUTCDay()===5&&s.getUTCDate()<=7?1:0},cal_days_to_month_end:(r,a,s)=>{let[_,,k]=R(a);return U(Date.UTC(k,_+1,0))-s},cal_days_to_quarter_end:(r,a,s)=>{let[_,,k]=R(a);return U(Date.UTC(k,Math.floor(_/3)*3+3,0))-s},cal_year_sin:(r,a)=>{let[,,s]=R(a),_=Date.UTC(s,0,1),k=Date.UTC(s+1,0,1)-_;return Math.sin(2*Math.PI*(a-_)/k)},cal_year_cos:(r,a)=>{let[,,s]=R(a),_=Date.UTC(s,0,1),k=Date.UTC(s+1,0,1)-_;return Math.cos(2*Math.PI*(a-_)/k)},cal_us_dst:(r,a)=>dt(a),event_days_since_war_escalation:(r,a,s)=>{let _=Ie(ke,s-1);return _===null?365:Math.min(365,s-_)},event_war_escalation_week:(r,a,s)=>ke.some(_=>s-_>=1&&s-_<=7)?1:0},fe=new Map,X=r=>{if(!fe.has(r)){let a=r*T+T/2,s=["mercury","venus","mars","jupiter","saturn"].map(f=>Re(f,a)),_=["mercury","venus","mars","jupiter","saturn"].map(f=>he(f,a)).sort((f,ie)=>f-ie),k=360-_[_.length-1]+_[0];for(let f=1;f<_.length;f++)k=Math.max(k,_[f]-_[f-1]);let q=De(a),K=Math.min(...[0,90,180,270,360].map(f=>Math.abs(q-f)));fe.set(r,{retro:s,spread:(360-k)/360,season:K/.98564736})}return fe.get(r)};if(Object.assign(F,{astro_moon_phase:(r,a)=>G(a)/360,astro_moon_illumination:(r,a)=>(1-Math.cos(H(G(a))))/2,astro_days_to_full_moon:(r,a)=>J(180-G(a))/360*_e,astro_days_to_new_moon:(r,a)=>J(360-G(a))/360*_e,astro_full_moon:(r,a)=>Math.abs(G(a)-180)/360*_e<=1?1:0,astro_new_moon:(r,a)=>{let s=G(a);return Math.min(s,360-s)/360*_e<=1?1:0},astro_mercury_retrograde:(r,a,s)=>X(s).retro[0]?1:0,astro_venus_retrograde:(r,a,s)=>X(s).retro[1]?1:0,astro_mars_retrograde:(r,a,s)=>X(s).retro[2]?1:0,astro_retrograde_count:(r,a,s)=>X(s).retro.filter(Boolean).length,astro_planet_spread:(r,a,s)=>X(s).spread,astro_days_to_season:(r,a,s)=>X(s).season}),v){let r=n=>ut(v,n),a=(n,u)=>re(n,u-2),s=n=>{let u=new Map;return(p,m,d)=>(u.has(d)||u.set(d,n(p,m,d)),u.get(d))},_=n=>(u,p,m)=>{let d=a(n,m);return d<0?0:n.val[d]},k=(n,u)=>(p,m,d)=>{let S=a(n,d);return S<u?0:n.val[S]-n.val[S-u]},q=(n,u)=>(p,m,d)=>{let S=a(n,d);return S<u?0:ne(n.val[S],n.val[S-u])},K=(n,u,p)=>re(n,p-u),f=(n,u,p)=>{b(n)&&(F[n]=s(p(...u.map(r))))};if(f("mkt_us10y",["US10Y"],n=>_(n)),f("mkt_us10y_chg_20d",["US10Y"],n=>k(n,20)),f("mkt_us2y",["US2Y"],n=>_(n)),f("mkt_yield_curve",["US10Y","US2Y"],(n,u)=>(p,m,d)=>{let S=a(n,d),x=a(u,d);return S<0||x<0?0:n.val[S]-u.val[x]}),f("mkt_fed_funds",["FEDFUNDS"],n=>_(n)),f("mkt_fed_funds_chg_90d",["FEDFUNDS"],n=>(u,p,m)=>{let d=re(n,m-2),S=re(n,m-92);return d<0||S<0?0:n.val[d]-n.val[S]}),f("mkt_wti_ret_5d",["WTI"],n=>q(n,5)),f("mkt_wti_ret_20d",["WTI"],n=>q(n,20)),f("mkt_brent_ret_5d",["BRENT"],n=>q(n,5)),f("mkt_natgas_ret_5d",["NATGAS"],n=>q(n,5)),f("mkt_dollar_ret_20d",["DOLLAR"],n=>q(n,20)),f("mkt_vix",["VIX"],n=>_(n)),f("mkt_vix_chg_5d",["VIX"],n=>k(n,5)),f("mkt_spx_ret_1m",["SP500M"],n=>(u,p,m)=>{let d=K(n,40,m);return d<1?0:ne(n.val[d],n.val[d-1])}),f("mkt_spx_drawdown_12m",["SP500M"],n=>(u,p,m)=>{let d=K(n,40,m);if(d<0)return 0;let S=-1/0;for(let x=Math.max(0,d-11);x<=d;x++)S=Math.max(S,n.val[x]);return ne(n.val[d],S)}),f("mkt_gold_ret_1m",["GOLDM"],n=>(u,p,m)=>{let d=K(n,40,m);return d<1?0:ne(n.val[d],n.val[d-1])}),f("macro_cpi_yoy",["CPI"],n=>(u,p,m)=>{let d=K(n,45,m);return d<12?0:ne(n.val[d],n.val[d-12])}),f("macro_unemployment",["UNRATE"],n=>(u,p,m)=>{let d=K(n,40,m);return d<0?0:n.val[d]}),l.some(n=>n.startsWith("event_quake"))){let n=(v.quakes||[]).map(([m,d])=>[Number(m),Number(d)]).sort((m,d)=>m[0]-d[0]),u=m=>{let d=0,S=n.length-1,x=-1;for(;d<=S;){let I=d+S>>1;n[I][0]<=m?(x=I,d=I+1):S=I-1}return x},p=(m,d,S)=>(x,I)=>{let we=0;for(let ee=u(I);ee>=0&&n[ee][0]>I-m*T;ee--)n[ee][1]>=d&&(we=S(we,n[ee][1]));return we};F.event_quakes_m6_7d=p(7,6,m=>m+1),F.event_quake_max_7d=p(7,6,(m,d)=>Math.max(m,d)),F.event_quakes_m7_30d=p(30,7,m=>m+1)}let ie=(v.storms||[]).map(([n,u,p])=>({first:n,last:u,wind:new Map(p)})),pe=n=>ie.filter(u=>u.wind.has(n)).map(u=>u.wind.get(n));if(F.event_storms_active=s((n,u,p)=>pe(p-1).length),F.event_storm_wind_max=s((n,u,p)=>Math.max(0,...pe(p-1))),F.event_major_storms_active=s((n,u,p)=>pe(p-1).filter(m=>m>=96).length),F.event_new_storms_7d=s((n,u,p)=>ie.filter(m=>m.first>=p-7&&m.first<=p-1).length),b("event_war_attention")){let n={day:Int32Array.from(v.warViews||[],u=>u[0]),val:Float64Array.from(v.warViews||[],u=>u[1])};F.event_war_attention=s((u,p,m)=>{let d=re(n,m-1);if(d<0)return 1;let S=0,x=0;for(let I=d-1;I>=0&&n.day[I]>=m-91;I--)S+=n.val[I],x++;return x&&S>0?n.val[d]/(S/x):1})}}for(let r of l)t.add(r,g(F[r]))}return qe(ht);})();

/*
MIT License

Copyright (c) 2026 Decentralized Science Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// World signals (src/studio/world_signals.js) are prepended to this worker at build time as GL1F_WORLD.
const WORLD_LIB = typeof GL1F_WORLD !== "undefined" ? GL1F_WORLD : { WORLD_FEATURES: [], WORLD_META: {}, addWorldFeatures: async () => {}, worldAvailability: (features) => features };
const { WORLD_FEATURES, WORLD_META, addWorldFeatures, worldAvailability } = WORLD_LIB;
// Public data for world signals (data/world.json) is fetched once per worker, when a selected world signal needs it.
let WORLD_ENV = { worldUrl: null }, WORLD_PROMISE = null;
// Public data for world signals is fetched live in the browser (world_sources.js). If a source cannot be reached, the
// copy the GL1F Crypto site publishes (data/world.json, readable from any page, even one opened from disk) fills in.
const LIVE_CACHE = new Map();
async function loadWorld(request) {
  const { world, errors } = await WORLD_LIB.fetchLiveWorld({ ...request, cache: LIVE_CACHE });
  const failed = Object.keys(errors);
  if (failed.length) {
    const copy = await loadWorldCopy();
    for (const k of failed) if (copy && WORLD_LIB.hasWorldKey(copy, k)) { WORLD_LIB.mergeWorldKey(world, copy, k); delete errors[k]; }
  }
  world.errors = errors;
  return world;
}
function loadWorldCopy() {
  WORLD_PROMISE ||= (async () => {
    for (const url of [WORLD_ENV.worldUrl, WORLD_ENV.copyUrl]) {
      if (!url || url.startsWith("file:")) continue;
      try { const r = await fetch(url, { cache: "no-cache" }); if (r.ok) return await r.json(); } catch { /* try the next copy */ }
    }
    return null;
  })().then((x) => { if (!x) WORLD_PROMISE = null; return x; });
  return WORLD_PROMISE;
}

// GL1F Crypto market engine.
// One worker builds datasets and replays inference vectors from completed
// Binance USD-M or Coinbase spot candles. The numeric feature engine is shared
// verbatim with the Dataset Studio contract (btc-context-v2, optimal-context-v3).
"use strict";

const INTERVAL_MIN = Object.freeze({
  "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
  "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480,
  "12h": 720, "1d": 1440,
});
const MINUTES_TO_INTERVAL = Object.freeze(Object.fromEntries(Object.entries(INTERVAL_MIN).map(([k, v]) => [v, k])));
const Q = 1_000_000;
const INT_CAP = 2_147_480_000;
const SAFE_ABS = INT_CAP / Q;
const TAIL_START = 1000;
const VOL_FLOOR = 1e-12;
const BTC_VARIANCE_FLOOR = 1e-12;
const HOUR_MS = 3_600_000;
const CANDLE_CACHE_DB = "gl1f-crypto-candles";
const CANDLE_CACHE_VERSION = 1;
const CANDLE_CACHE_BATCH = 5000;
// Longest run of consecutive no-trade Coinbase buckets that is filled. Longer holes are
// treated as an outage or halted market and stop the build instead of being papered over.
const MAX_FILLED_GAP_MINUTES = 360;

const EXCHANGES = Object.freeze({
  binance: Object.freeze({
    id: "binance", venue: "binance-usdm", name: "Binance USD-M", short: "Binance",
    base: "https://fapi.binance.com", schema: "binance-usdm-kline-v1",
    width: 11, pageRows: 1000, pauseMs: 220, parallel: 6, intervalMs: 170, settleMs: 0, maxPages: 2500,
  }),
  coinbase: Object.freeze({
    id: "coinbase", venue: "coinbase-spot", name: "Coinbase", short: "Coinbase",
    base: "https://api.exchange.coinbase.com", schema: "coinbase-spot-candle-v1",
    // 300 buckets per request; windows overlap by one bucket so full coverage
    // does not depend on whether the provider treats `end` as inclusive.
    width: 7, pageRows: 299, pauseMs: 140, parallel: 4, intervalMs: 125, settleMs: 15_000, maxPages: 5000,
    nativeMinutes: Object.freeze([1440, 360, 60, 15, 5, 1]),
  }),
  hyperliquid: Object.freeze({
    id: "hyperliquid", venue: "hyperliquid-perp", name: "Hyperliquid", short: "Hyperliquid",
    base: "https://api.hyperliquid.xyz", schema: "hyperliquid-perp-candle-v1",
    // POST /info candleSnapshot serves only the latest 5,000 candles per coin and size.
    // Row: [open, o, h, l, c, volume, trades, synthetic]; windows of 4,000 candles per request.
    width: 8, pageRows: 4000, pauseMs: 260, settleMs: 2000, maxPages: 400, historyRows: 5000,
    nativeMinutes: Object.freeze([1440, 720, 480, 240, 120, 60, 30, 15, 5, 3, 1]),
  }),
});
const VENUE_EXCHANGE = Object.freeze({ "binance-usdm": "binance", "coinbase-spot": "coinbase", "hyperliquid-perp": "hyperliquid" });
// Hyperliquid needs at least 15m candles: its 5,000-candle history must cover the 528-hour warm-up.
const HYPERLIQUID_MIN_MINUTES = 15;

const FULL_FEATURES = `ret_1h ret_2h ret_4h ret_8h ret_12h ret_24h ret_48h ret_72h ret_168h
ret_1h_lag1 ret_1h_lag2 ret_1h_lag3 ret_1h_lag4 ret_1h_lag6 ret_1h_lag12 ret_1h_lag24
realized_vol_6h realized_vol_12h realized_vol_24h realized_vol_48h realized_vol_168h
parkinson_24 gk_24 atr_14_rel atr_24_rel atr_pct_14 tr_pct rsi_14h rsi_24h macd macd_signal macd_hist
roc_6h roc_12h roc_24h roc_48h willr_14h stoch_k_14h willr_24h stoch_k_24h cci_20h
ema_ratio_9h ema_ratio_21h ema_ratio_50h ema_ratio_100h ema_ratio_200h close_to_ema5 adx_14h
dist_high_24h dist_low_24h dist_high_72h dist_low_72h dist_high_168h dist_low_168h bb_pctb_20h bb_width_20h
log_volume vol_z_24 vol_z_168 vol_ma_ratio_24h taker_buy_ratio taker_imbalance taker_imbalance_ma_6h taker_imbalance_ma_24h
obv_z_168h mfi_14h vwap_dev_24h vwap_dev_72h body_ratio upper_wick lower_wick gap_open log_trades log_avg_trade_size
funding_rate funding_rate_ma_24h funding_rate_ma_72h funding_rate_change funding_cum_24h funding_positive_frac_168h
hour_sin hour_cos dow_sin dow_cos is_weekend is_friday
rv_6h rv_24h rv_48h rv_168h rv_336h park_6h park_48h park_72h park_168h gk_6h gk_48h gk_168h rs_12h rs_48h rs_168h
atr_14_pct atr_48_pct rv_short_vs_long_504 rv_medium_vs_long rv24_rank_168 rv24_rank_504 vol_of_vol_168 vol_of_vol_504
rv_log_change_12h rv_log_change_24h rv_log_change_72h jumps_2sigma_168h max_abs_ret_scaled_24h max_abs_ret_scaled_168h
jump_ratio_24h jump_ratio_72h neg_var_24h pos_var_24h neg_var_72h semivol_ratio_72h pos_var_168h semivol_ratio_168h
hl_range_mean_24h hl_range_mean_168h hl_range_max_72h hl_range_max_168h taker_imbalance_abs_ma_24h
r1_log r12_log RSI14 ATR_norm14 body_range_ratio BollBW50 ATR_ratio100 BW_CHOP100 ATR_HL_ratio100 TrendConsist100
return_5_3 return_60_3 volatility_5 mom_5 hour dow dist_ema5_atr rv6_over_rv24 body_signed_3 wick_imbalance_3
volume_surge_3 taker_imb_sum_6 ret_skew_24h sign_persist_12 range_efficiency_6 trend_r2_12 dist_high24_atr dist_low24_atr
btc_ret_1h btc_ret_4h btc_ret_24h relative_ret_btc_4h relative_ret_btc_24h btc_residual_4h btc_corr_7d btc_beta_7d coin_btc_breakout_24h btc_realized_vol_4h`.split(/\s+/);

const SMALL_FEATURES = `r1_log r12_log RSI14 ATR_norm14 body_range_ratio ATR_ratio100 BollBW50 BW_CHOP100 ATR_HL_ratio100 TrendConsist100
return_5_3 return_60_3 volatility_5 mom_5 hour dow funding_rate funding_rate_ma_24h funding_cum_24h close_to_ema5
dist_ema5_atr rv6_over_rv24 body_signed_3 wick_imbalance_3 volume_surge_3 taker_imb_sum_6 ret_skew_24h sign_persist_12
range_efficiency_6 trend_r2_12 dist_high24_atr dist_low24_atr btc_ret_1h btc_ret_4h btc_ret_24h relative_ret_btc_4h
relative_ret_btc_24h btc_residual_4h btc_corr_7d btc_beta_7d coin_btc_breakout_24h btc_realized_vol_4h`.split(/\s+/);

const OPTIMAL_FEATURES = `ema5_native_logdist_bps ema5_native_dist_atr ema5_native_slope3_atr atr14_native_bps atr100_native_bps
ret_1h_log_bps ret_4h_log_bps ret_12h_log_bps ret_24h_log_bps breakout_high_4h_rv dist_high_24h_rv dist_low_24h_rv
efficiency_4h_signed ema20_1h_logdist_bps ema20_1h_slope4_atr rv_1h_bps rv_4h_bps rv_24h_bps rv_4h_vs_24h_log
rv_24h_rank_7d bb_logwidth_4h_bps bb_logwidth_4h_rank_7d downside_variation_share_4h volume_activity_1h volume_activity_4h
trades_activity_1h taker_imbalance_1h taker_imbalance_4h body_signed_native wick_imbalance_native btc_ret_1h_log_bps
btc_ret_4h_log_bps btc_ret_24h_log_bps relative_btc_ret_4h_log_bps relative_btc_ret_24h_log_bps btc_residual_4h_log_bps
btc_corr_7d btc_beta_7d coin_btc_breakout_24h_log_bps btc_rv_4h_bps btc_residual_4h_z btc_corr_change_1d_7d
utc_day_sin utc_day_cos utc_week_sin utc_week_cos funding_mean_24h_bps funding_paid_24h_bps`.split(/\s+/);

const ALL_FEATURES = [...FULL_FEATURES, ...OPTIMAL_FEATURES.filter((x) => !FULL_FEATURES.includes(x)), ...WORLD_FEATURES];
const FULL_SET = new Set(FULL_FEATURES);
const OPTIMAL_SET = new Set(OPTIMAL_FEATURES);
const FUNDING_SET = new Set(ALL_FEATURES.filter((x) => x.startsWith("funding_")));
const TRADES_SET = new Set(["log_trades", "log_avg_trade_size", "trades_activity_1h"]);
const TAKER_SET = new Set(ALL_FEATURES.filter((x) => x.includes("taker")));
const FORBIDDEN = new Set(["open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote", "open_time", "baseline", "target", "stop", "label", "symbol"]);

// What each venue publishes beyond OHLCV. Binance USD-M: funding (8-hourly), trade counts and taker flow.
// Hyperliquid perps: funding (hourly) and trade counts, no taker flow. Coinbase spot: OHLCV only.
const EXCHANGE_PROVIDES = Object.freeze({
  binance: new Set(["funding", "trade counts", "taker flow"]),
  coinbase: new Set(),
  hyperliquid: new Set(["funding", "trade counts"]),
});
function featureRequirement(name) {
  if (WORLD_META[name]) return WORLD_META[name].needs.length ? "public data" : "";
  if (FUNDING_SET.has(name)) return "funding";
  if (TRADES_SET.has(name)) return "trade counts";
  if (TAKER_SET.has(name)) return "taker flow";
  return null;
}
function featureAvailable(name, exchange) {
  if (WORLD_META[name]) return true;
  const need = featureRequirement(name);
  return need === null || !!EXCHANGE_PROVIDES[exchange]?.has(need);
}

let cancelled = false;
let activeController = null;
let candleDbPromise = null;
let candleDbMode = "unresolved";
let candleCacheWriteFailed = false;
let jobRunning = false;
const memoryCandles = new Map();
const memorySeriesMeta = new Map();

function post(type, detail = {}, transfer = []) {
  if (typeof self !== "undefined" && self.postMessage) self.postMessage({ type, ...detail }, transfer);
}
function progress(value, stage, message) {
  post("progress", { value: Math.max(0, Math.min(1, value)), stage, message });
}
function pause(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function pauseAbortable(ms, signal) {
  if (!signal) return pause(ms);
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
  });
}
function assertActive() {
  if (cancelled) throw new DOMException("Cancelled", "AbortError");
}

// ---------------------------------------------------------------------------
// Numeric engine (shared verbatim with the Dataset Studio contract)
// ---------------------------------------------------------------------------
function pyRoundPositive(x) {
  const floor = Math.floor(x);
  const fraction = x - floor;
  if (fraction < 0.5) return floor;
  if (fraction > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}
function zeros(n, value = NaN) {
  const out = new Float64Array(n);
  if (Number.isNaN(value)) out.fill(NaN);
  else if (value !== 0) out.fill(value);
  return out;
}
function finite(x) { return Number.isFinite(x); }
function lowerBound(array, value) {
  let lo = 0, hi = array.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (array[mid] < value) lo = mid + 1; else hi = mid; }
  return lo;
}
function upperBound(array, value) {
  let lo = 0, hi = array.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (array[mid] <= value) lo = mid + 1; else hi = mid; }
  return lo;
}
function addArrays(a, b, fn) {
  const n = a.length, out = zeros(n);
  for (let i = 0; i < n; i++) if (finite(a[i]) && finite(b[i])) out[i] = fn(a[i], b[i], i);
  return out;
}
function unary(a, fn) {
  const out = zeros(a.length);
  for (let i = 0; i < a.length; i++) if (finite(a[i])) out[i] = fn(a[i], i);
  return out;
}
function safeDivide(a, b, zero = 0) {
  const n = a.length, out = zeros(n);
  for (let i = 0; i < n; i++) {
    if (!finite(a[i]) || !finite(b[i])) continue;
    out[i] = b[i] === 0 ? zero : a[i] / b[i];
  }
  return out;
}
function scalarDivide(a, b, zero = 0) {
  if (!finite(a) || !finite(b)) return NaN;
  return b === 0 ? zero : a / b;
}
function clip(a, lo, hi) {
  return unary(a, (x) => Math.min(hi, Math.max(lo, x)));
}
function shift(a, k) {
  const out = zeros(a.length);
  for (let i = k; i < a.length; i++) out[i] = a[i - k];
  return out;
}
function diff(a, k = 1) {
  const out = zeros(a.length);
  for (let i = k; i < a.length; i++) if (finite(a[i]) && finite(a[i - k])) out[i] = a[i] - a[i - k];
  return out;
}
function pctChange(a, k = 1) {
  const out = zeros(a.length);
  for (let i = k; i < a.length; i++) if (finite(a[i]) && finite(a[i - k]) && a[i - k] !== 0) out[i] = a[i] / a[i - k] - 1;
  return out;
}
function rollingSum(a, window) {
  const out = zeros(a.length);
  if (window < 1) return out;
  let sum = 0, count = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; if (finite(x)) { sum += x; count++; }
    if (i >= window) { const old = a[i - window]; if (finite(old)) { sum -= old; count--; } }
    if (i >= window - 1 && count === window) out[i] = sum;
    if ((i & 16383) === 16383 && i >= window) {
      sum = 0; count = 0;
      for (let j = i - window + 1; j <= i; j++) if (finite(a[j])) { sum += a[j]; count++; }
    }
  }
  return out;
}
function rollingMean(a, window) {
  return unary(rollingSum(a, window), (x) => x / window);
}
function rollingVariance(a, window, ddof = 1) {
  const out = zeros(a.length);
  if (window <= ddof) return out;
  // Short windows are common for price/log-price features. A fresh two-pass
  // calculation matches pandas closely and avoids accumulated remove/add drift.
  if (window <= 512) {
    for (let i = window - 1; i < a.length; i++) {
      let mean = 0, ok = true;
      for (let j = i - window + 1; j <= i; j++) { if (!finite(a[j])) { ok = false; break; } mean += a[j]; }
      if (!ok) continue;
      mean /= window; let ss = 0;
      for (let j = i - window + 1; j <= i; j++) { const d = a[j] - mean; ss += d * d; }
      out[i] = Math.max(0, ss / (window - ddof));
    }
    return out;
  }
  let count = 0, mean = 0, m2 = 0;
  const add = (x) => { count++; const d = x - mean; mean += d / count; m2 += d * (x - mean); };
  const remove = (x) => {
    if (count <= 1) { count = 0; mean = 0; m2 = 0; return; }
    const nextCount = count - 1;
    const nextMean = (count * mean - x) / nextCount;
    m2 -= (x - mean) * (x - nextMean);
    count = nextCount; mean = nextMean;
    if (m2 < 0 && m2 > -1e-12 * Math.max(1, Math.abs(mean))) m2 = 0;
  };
  for (let i = 0; i < a.length; i++) {
    if (finite(a[i])) add(a[i]);
    if (i >= window && finite(a[i - window])) remove(a[i - window]);
    if (i >= window - 1 && count === window) out[i] = Math.max(0, m2 / (window - ddof));
  }
  return out;
}
function rollingStd(a, window) {
  const w = Math.max(2, window);
  return unary(rollingVariance(a, w, 1), Math.sqrt);
}
function rollingCovariance(a, b, window) {
  const out = zeros(a.length);
  if (window < 2) return out;
  let sx = 0, sy = 0, sxy = 0, count = 0;
  for (let i = 0; i < a.length; i++) {
    if (finite(a[i]) && finite(b[i])) { sx += a[i]; sy += b[i]; sxy += a[i] * b[i]; count++; }
    if (i >= window && finite(a[i - window]) && finite(b[i - window])) {
      sx -= a[i - window]; sy -= b[i - window]; sxy -= a[i - window] * b[i - window]; count--;
    }
    if (i >= window - 1 && count === window) out[i] = (sxy - sx * sy / window) / (window - 1);
  }
  return out;
}
function rollingMinMax(a, window, wantMax) {
  const out = zeros(a.length), deque = new Int32Array(a.length);
  let head = 0, tail = 0, finiteCount = 0;
  for (let i = 0; i < a.length; i++) {
    if (finite(a[i])) {
      finiteCount++;
      while (tail > head && (wantMax ? a[deque[tail - 1]] <= a[i] : a[deque[tail - 1]] >= a[i])) tail--;
      deque[tail++] = i;
    }
    if (i >= window) {
      const old = i - window;
      if (finite(a[old])) finiteCount--;
      if (tail > head && deque[head] === old) head++;
    }
    if (i >= window - 1 && finiteCount === window) out[i] = a[deque[head]];
    if (head > 65536 && head * 2 > tail) { deque.copyWithin(0, head, tail); tail -= head; head = 0; }
  }
  return out;
}
function rollingMax(a, w) { return rollingMinMax(a, w, true); }
function rollingMin(a, w) { return rollingMinMax(a, w, false); }
function ewmAlpha(a, alpha) {
  const out = zeros(a.length);
  let started = false, prev = NaN;
  for (let i = 0; i < a.length; i++) {
    if (!finite(a[i])) { if (started) out[i] = prev; continue; }
    if (!started) { prev = a[i]; started = true; }
    else prev = (1 - alpha) * prev + alpha * a[i];
    out[i] = prev;
  }
  return out;
}
function ema(a, span) { return ewmAlpha(a, 2 / (span + 1)); }
function trueRange(k) {
  const out = zeros(k.close.length);
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(k.high[i] - k.low[i]);
    if (i === 0) out[i] = a;
    else out[i] = Math.max(a, Math.abs(k.high[i] - k.close[i - 1]), Math.abs(k.low[i] - k.close[i - 1]));
  }
  return out;
}
function atrEwm(k, period) { return ewmAlpha(trueRange(k), 1 / period); }
function atrSma(k, period) { return rollingMean(trueRange(k), period); }
function rollingMad(a, window) {
  const out = zeros(a.length), mean = rollingMean(a, window);
  for (let i = window - 1; i < a.length; i++) {
    if (!finite(mean[i])) continue;
    let sum = 0, ok = true;
    for (let j = i - window + 1; j <= i; j++) { if (!finite(a[j])) { ok = false; break; } sum += Math.abs(a[j] - mean[i]); }
    if (ok) out[i] = sum / window;
  }
  return out;
}
function rollingSkew(a, window) {
  const out = zeros(a.length);
  if (window < 3) return out;
  let s1 = 0, s2 = 0, s3 = 0, count = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; if (finite(x)) { s1 += x; s2 += x*x; s3 += x*x*x; count++; }
    if (i >= window) { const y = a[i-window]; if (finite(y)) { s1 -= y; s2 -= y*y; s3 -= y*y*y; count--; } }
    if (i >= window - 1 && count === window) {
      const mean = s1 / window;
      const m2 = Math.max(0, s2 / window - mean*mean);
      if (m2 === 0) out[i] = 0;
      else {
        const m3 = s3 / window - 3*mean*(s2/window) + 2*mean*mean*mean;
        out[i] = Math.sqrt(window * (window - 1)) / (window - 2) * m3 / Math.pow(m2, 1.5);
      }
    }
  }
  return out;
}

class Fenwick {
  constructor(n) { this.tree = new Int32Array(n + 1); }
  add(index, delta) { for (let i = index + 1; i < this.tree.length; i += i & -i) this.tree[i] += delta; }
  sum(endExclusive) { let s = 0; for (let i = endExclusive; i > 0; i -= i & -i) s += this.tree[i]; return s; }
}
function rollingPriorRank(a, priorWindow, midTies) {
  const out = zeros(a.length);
  const values = Array.from(a).filter(finite).sort((x,y) => x-y);
  const unique = values.filter((x,i) => i === 0 || x !== values[i-1]);
  const bit = new Fenwick(unique.length); let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (i > 0 && finite(a[i-1])) { bit.add(lowerBound(unique, a[i-1]), 1); count++; }
    if (i > priorWindow) { const old = a[i-priorWindow-1]; if (finite(old)) { bit.add(lowerBound(unique, old), -1); count--; } }
    if (i >= priorWindow && count === priorWindow && finite(a[i])) {
      const lt = bit.sum(lowerBound(unique, a[i]));
      const le = bit.sum(upperBound(unique, a[i]));
      out[i] = (lt + (midTies ? 0.5 * (le - lt) : 0)) / priorWindow;
    }
  }
  return out;
}

function nextUp(x) {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x, false);
  let bits = view.getBigUint64(0, false); bits = x > 0 ? bits + 1n : bits - 1n;
  view.setBigUint64(0, bits, false); return view.getFloat64(0, false);
}
function nextDown(x) {
  if (Number.isNaN(x) || x === -Infinity) return x;
  if (x === 0) return -Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x, false);
  let bits = view.getBigUint64(0, false); bits = x > 0 ? bits - 1n : bits + 1n;
  view.setBigUint64(0, bits, false); return view.getFloat64(0, false);
}

function tailTransform(a) {
  const out = new Float64Array(a.length); let changed = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (!finite(x)) out[i] = NaN;
    else if (Math.abs(x) > TAIL_START) { out[i] = Math.sign(x) * (TAIL_START + Math.log1p(Math.abs(x) - TAIL_START)); changed = true; }
    else out[i] = x;
  }
  return { values: out, changed };
}

function featureGroup(name) {
  if (WORLD_META[name]) return WORLD_META[name].group;
  if (name.startsWith("funding_")) return "Funding";
  if (name.startsWith("btc_") || name.includes("_btc_") || name.startsWith("coin_btc")) return "BTC context";
  if (name === "downside_variation_share_4h") return "Volatility";
  if (/^(hour|dow|is_|utc_)/.test(name)) return "Calendar";
  if (/(volume|taker|trades|obv|mfi|vwap)/i.test(name)) return "Volume & flow";
  if (/(atr|vol|rv_|realized|parkinson|park_|gk_|rs_|boll|bb_|chop|jump|semivol|hl_range)/i.test(name)) return "Volatility";
  if (/(ema|macd|adx|rsi|willr|stoch|cci|mom|trend)/i.test(name)) return "Trend & momentum";
  if (/(body|wick|gap|range_efficiency)/i.test(name)) return "Candle structure";
  return "Returns & position";
}
function featureNote(name) {
  if (WORLD_META[name]) return WORLD_META[name].note;
  if (/ret_1h_lag/.test(name)) return "One native-bar log return, shifted by native bars.";
  if (name === "return_5_3") return "Simple return across 3 native bars (legacy name).";
  if (name === "return_60_3") return "Simple return across 36 native bars (legacy name).";
  if (name === "volume_surge_3") return "Current volume versus trailing 6-hour mean (legacy name).";
  if (name === "hour" || name === "dow") return "Raw UTC open-time calendar value; cyclical alternatives are available.";
  if (name.includes("native")) return "Computed on the selected native candle interval.";
  if (name.endsWith("_bps")) return "Basis-point-scaled causal value (×10,000).";
  if (name.startsWith("funding_")) return "Historical funding known by candle open.";
  if (featureGroup(name) === "BTC context") return "Exact-time BTC market context; no future join.";
  return "Causal derived numeric feature.";
}
function alignExact(native, context, nativeMin, contextMin, source) {
  const lookup = new Map(); for (let i=0;i<context.time.length;i++) lookup.set(context.time[i],i);
  const out = zeros(native.time.length), offset = (nativeMin-contextMin)*60_000;
  for (let i=0;i<native.time.length;i++) {
    const j = lookup.get(native.time[i]+offset);
    if (j === undefined) throw new Error(`Missing context candle at ${new Date(native.time[i]+offset).toISOString()}`);
    out[i] = source[j];
  }
  return out;
}

function alignBtcClose(coin,btc){
  const lookup=new Map();for(let i=0;i<btc.time.length;i++)lookup.set(btc.time[i],btc.close[i]);
  const close=new Float64Array(coin.time.length);for(let i=0;i<coin.time.length;i++){const value=lookup.get(coin.time[i]);if(value===undefined)throw new Error(`BTC context missing at ${new Date(coin.time[i]).toISOString()}`);close[i]=value;}return close;
}

class FeatureStore {
  constructor(selected) { this.selected = new Set(selected); this.columns = new Map(); this.tailColumns = new Set(); }
  wants(name) { return this.selected.has(name); }
  wantsAny(names) { return names.some((name) => this.selected.has(name)); }
  add(name, values) {
    if (!this.wants(name) || this.columns.has(name)) return;
    if (!(values instanceof Float64Array)) values = Float64Array.from(values);
    const encoded = tailTransform(values);
    this.columns.set(name, encoded.values);
    if (encoded.changed) this.tailColumns.add(name);
  }
}

function logArray(a) { return unary(a, Math.log); }
function absArray(a) { return unary(a, Math.abs); }
function squareArray(a) { return unary(a, (x)=>x*x); }
function scaleArray(a, factor) { return unary(a, (x)=>x*factor); }
function subtract(a,b) { return addArrays(a,b,(x,y)=>x-y); }
function add(a,b) { return addArrays(a,b,(x,y)=>x+y); }
function multiply(a,b) { return addArrays(a,b,(x,y)=>x*y); }
function divideByCurrent(a, current) { return safeDivide(a,current); }
function rollingProductSum(a,b,w) { return rollingSum(multiply(a,b),w); }
function rollingRsi(close, period, ewm) {
  const delta = diff(close), gain = zeros(close.length), loss = zeros(close.length);
  for (let i=0;i<close.length;i++) if (finite(delta[i])) { gain[i]=Math.max(delta[i],0); loss[i]=Math.max(-delta[i],0); }
  const ag = ewm ? ewmAlpha(gain,1/period) : rollingMean(gain,period);
  const al = ewm ? ewmAlpha(loss,1/period) : rollingMean(loss,period);
  return clip(scaleArray(safeDivide(ag,add(ag,al),.5),100),0,100);
}
function parkinson(k, period) {
  const x=zeros(k.close.length);
  for(let i=0;i<x.length;i++){const d=Math.log(k.high[i])-Math.log(k.low[i]);x[i]=d*d;}
  return unary(rollingMean(x,period),(v)=>Math.sqrt(v/(4*Math.log(2))));
}
function garmanKlass(k,period){
  const x=zeros(k.close.length);
  for(let i=0;i<x.length;i++){const hl=Math.log(k.high[i])-Math.log(k.low[i]),co=Math.log(k.close[i])-Math.log(k.open[i]);x[i]=.5*hl*hl-(2*Math.log(2)-1)*co*co;}
  return unary(rollingMean(x,period),(v)=>Math.sqrt(Math.max(0,v)));
}
function rogersSatchell(k,period){
  const x=zeros(k.close.length);
  for(let i=0;i<x.length;i++){const ho=Math.log(k.high[i])-Math.log(k.open[i]),hc=Math.log(k.high[i])-Math.log(k.close[i]),lo=Math.log(k.low[i])-Math.log(k.open[i]),lc=Math.log(k.low[i])-Math.log(k.close[i]);x[i]=ho*hc+lo*lc;}
  return unary(rollingMean(x,period),(v)=>Math.sqrt(Math.max(0,v)));
}
function rollingChop(k,window){
  const sumTr=rollingSum(trueRange(k),window),hh=rollingMax(k.high,window),ll=rollingMin(k.low,window),out=zeros(k.close.length);
  for(let i=0;i<out.length;i++) if(finite(sumTr[i])&&finite(hh[i])&&finite(ll[i])){const ratio=(hh[i]-ll[i])===0?window:sumTr[i]/(hh[i]-ll[i]);out[i]=100*Math.log10(Math.max(1,ratio))/Math.log10(window);}
  return out;
}
function rollingTrendConsistency(close,window,seg=10){
  const out=zeros(close.length),nSegs=Math.floor(window/seg);
  if(nSegs<2)return out;
  for(let end=window;end<=close.length;end++){
    const avgs=[];let ok=true;
    for(let s=0;s<nSegs;s++){let sum=0;for(let j=end-window+s*seg;j<end-window+(s+1)*seg;j++){if(!finite(close[j])){ok=false;break;}sum+=close[j];}if(!ok)break;avgs.push(sum/seg);}
    if(!ok)continue;const ds=new Float64Array(avgs.length-1);for(let j=1;j<avgs.length;j++)ds[j-1]=avgs[j]-avgs[j-1];let mean=0;for(const x of ds)mean+=x;mean/=ds.length;let ss=0;for(const x of ds)ss+=(x-mean)*(x-mean);out[end-1]=Math.sqrt(ss/(ds.length-1));
  }
  return out;
}
function rollingTrendR2(close,window=12){
  const out=zeros(close.length),xMean=(window-1)/2;let sxx=0;for(let j=0;j<window;j++)sxx+=(j-xMean)*(j-xMean);
  for(let i=window-1;i<close.length;i++){let mean=0;for(let j=0;j<window;j++)mean+=close[i-window+1+j];mean/=window;let syy=0,sxy=0;for(let j=0;j<window;j++){const y=close[i-window+1+j]-mean;syy+=y*y;sxy+=(j-xMean)*y;}out[i]=syy===0?0:Math.min(1,Math.max(0,sxy*sxy/(sxx*syy)));}
  return out;
}
function buildBtcContext(coin,btc,minutes){
  if(minutes>60)throw new Error("BTC context must use 1h or finer candles");
  const H=(hours)=>Math.max(1,pyRoundPositive(hours*60/minutes));
  const lc=logArray(coin.close),lb=logArray(alignBtcClose(coin,btc)),rc=diff(lc),rb=diff(lb),result={lc,lb,rc,rb};
  for(const hours of [1,4,24])result[`btc_ret_${hours}h`]=diff(lb,H(hours));
  for(const hours of [4,24])result[`relative_ret_btc_${hours}h`]=subtract(diff(lc,H(hours)),diff(lb,H(hours)));
  const n=H(168),bcov=rollingCovariance(rc,rb,n),bvar=rollingVariance(rb,n),cvar=rollingVariance(rc,n),beta=zeros(rc.length),corr=zeros(rc.length);
  const mrc=rollingMean(rc,n),mrb=rollingMean(rb,n),alpha=zeros(rc.length);
  for(let i=0;i<rc.length;i++){
    if(!finite(bvar[i])||!finite(cvar[i])||!finite(bcov[i]))continue;
    const identified=bvar[i]>BTC_VARIANCE_FLOOR;
    beta[i]=identified?bcov[i]/bvar[i]:0;
    corr[i]=(!identified||cvar[i]<=BTC_VARIANCE_FLOOR)?0:Math.max(-1,Math.min(1,bcov[i]/Math.sqrt(bvar[i]*cvar[i])));
    if(finite(mrc[i])&&finite(mrb[i]))alpha[i]=mrc[i]-beta[i]*mrb[i];
  }
  const residual=zeros(rc.length);
  for(let i=1;i<rc.length;i++)if(finite(rc[i])&&finite(alpha[i-1])&&finite(beta[i-1])&&finite(rb[i]))residual[i]=rc[i]-(alpha[i-1]+beta[i-1]*rb[i]);
  result.btc_residual_4h=rollingSum(residual,H(4));result.btc_corr_7d=corr;result.btc_beta_7d=beta;result.alpha=alpha;result.residual=residual;
  const ratio=subtract(lc,lb),priorHigh=shift(rollingMax(ratio,H(24)),1);
  result.coin_btc_breakout_24h=subtract(ratio,priorHigh);result.btc_realized_vol_4h=rollingStd(rb,H(4));
  return result;
}

function legacyFunding(funding,times,H){
  if(!funding||!funding.time.length)throw new Error("No funding history returned. Deselect funding features to continue.");
  const fr=zeros(times.length),cum=zeros(times.length);let p=-1,left=0,sum=0;
  for(let i=0;i<times.length;i++){
    while(p+1<funding.time.length&&funding.time[p+1]<=times[i])p++;
    if(p>=0)fr[i]=funding.rate[p];
  }
  let hi=0;left=0;sum=0;
  for(let i=0;i<times.length;i++){
    while(hi<funding.time.length&&funding.time[hi]<=times[i]){sum+=funding.rate[hi];hi++;}
    while(left<hi&&funding.time[left]<=times[i]-24*HOUR_MS){sum-=funding.rate[left];left++;}
    if(finite(fr[i]))cum[i]=sum;
  }
  const positive=zeros(times.length);for(let i=0;i<times.length;i++)if(finite(fr[i]))positive[i]=fr[i]>0?1:0;
  return {funding_rate:fr,funding_rate_ma_24h:rollingMean(fr,H(24)),funding_rate_ma_72h:rollingMean(fr,H(72)),funding_rate_change:diff(fr),funding_cum_24h:cum,funding_positive_frac_168h:rollingMean(positive,H(168))};
}

function optimalFunding(funding,times){
  if(!funding||!funding.time.length)throw new Error("No funding history returned. Deselect funding features to continue.");
  const n=funding.time.length,integral=new Float64Array(n),payments=new Float64Array(n+1);
  for(let i=1;i<n;i++)integral[i]=integral[i-1]+funding.rate[i-1]*(funding.time[i]-funding.time[i-1])/1000;
  for(let i=0;i<n;i++)payments[i+1]=payments[i]+funding.rate[i];
  const at=(t)=>{const pos=upperBound(funding.time,t)-1;if(pos<0)return null;return integral[pos]+funding.rate[pos]*(t-funding.time[pos])/1000;};
  const mean=zeros(times.length),paid=zeros(times.length);
  for(let i=0;i<times.length;i++){
    const leftT=times[i]-24*HOUR_MS,ri=at(times[i]),li=at(leftT);if(ri===null||li===null)continue;
    mean[i]=(ri-li)/86400*10000;
    const lo=upperBound(funding.time,leftT),hi=upperBound(funding.time,times[i]);paid[i]=(payments[hi]-payments[lo])*10000;
  }
  return {funding_mean_24h_bps:mean,funding_paid_24h_bps:paid};
}

function aggregateCompleteHours(context,minutes){
  if(minutes>60||60%minutes)throw new Error("Hourly context requires an interval that exactly divides one hour");
  const need=60/minutes,buckets=new Map();
  for(let i=0;i<context.time.length;i++){
    const start=Math.floor(context.time[i]/HOUR_MS)*HOUR_MS;let b=buckets.get(start);
    if(!b){b={count:0,open:context.open[i],high:-Infinity,low:Infinity,close:NaN};buckets.set(start,b);}
    b.count++;b.high=Math.max(b.high,context.high[i]);b.low=Math.min(b.low,context.low[i]);b.close=context.close[i];
  }
  const entries=[...buckets.entries()].filter(([,b])=>b.count===need).sort((a,b)=>a[0]-b[0]),n=entries.length;
  const out={time:new Float64Array(n),open:new Float64Array(n),high:new Float64Array(n),low:new Float64Array(n),close:new Float64Array(n)};
  entries.forEach(([start,b],i)=>{out.time[i]=start+HOUR_MS;out.open[i]=b.open;out.high[i]=b.high;out.low[i]=b.low;out.close[i]=b.close;});
  return out;
}

function alignLastReady(native,hourly,source,nativeMin){
  const out=zeros(native.time.length);let j=-1;
  for(let i=0;i<native.time.length;i++){const ready=native.time[i]+nativeMin*60_000;while(j+1<hourly.time.length&&hourly.time[j+1]<=ready)j++;if(j>=0)out[i]=source[j];}
  return out;
}

async function tripleBarrier(k,spec){
  const n=k.close.length,h=spec.horizonBars,baseline=ema(k.close,spec.basePeriod),labels=new Int8Array(n);labels.fill(-1);
  const valid=Math.max(0,n-h),target=new Float64Array(valid),stop=new Float64Array(valid);
  for(let i=0;i<valid;i++){
    const b=baseline[i];if(!finite(b)||b<=0)throw new Error("Computed EMA baseline is invalid");
    if(spec.direction==="up"){target[i]=nextDown(b*(1+spec.movePct/100));stop[i]=nextUp(b*(1-spec.retracePct/100));}
    else{target[i]=nextUp(b*(1-spec.movePct/100));stop[i]=nextDown(b*(1+spec.retracePct/100));}
    if(!finite(target[i])||!finite(stop[i])||target[i]<=0||stop[i]<=0)throw new Error("Computed target/stop is not finite and positive");
    labels[i]=0;
  }
  let active=Int32Array.from({length:valid},(_,i)=>i);
  for(let offset=1;offset<=h&&active.length;offset++){
    const next=new Int32Array(active.length);let count=0;
    for(let j=0;j<active.length;j++){
      const i=active[j],future=i+offset;
      const hitTarget=spec.direction==="up"?k.high[future]>=target[i]:k.low[future]<=target[i];
      const hitStop=spec.direction==="up"?k.low[future]<=stop[i]:k.high[future]>=stop[i];
      if(hitTarget&&!hitStop)labels[i]=1;
      if(!hitTarget&&!hitStop)next[count++]=i;
    }
    active=next.slice(0,count);
    if(offset%Math.max(1,Math.floor(h/20))===0){progress(.72+.05*offset/h,"label",`Scanning future barriers · ${offset}/${h} bars`);await pause();assertActive();}
  }
  return labels;
}

async function buildLegacyFeatures(k,candle,context,btc,funding,store){
  const minutes=INTERVAL_MIN[candle],barsPerHour=60/minutes,H=(hours)=>Math.max(1,pyRoundPositive(hours*barsPerHour));
  const o=k.open,hi=k.high,lo=k.low,c=k.close,v=k.volume,trades=k.trades,tb=k.takerBuy,n=c.length;
  const lc=logArray(c),r1=diff(lc),absR1=absArray(r1),tr=trueRange(k);
  const addF=(name,a)=>store.add(name,a),wants=(...names)=>store.wantsAny(names.flat());
  await addWorldFeatures(store,k.time,minutes,loadWorld);
  progress(.39,"features","Legacy returns and price context");

  for(const hours of [1,2,4,8,12,24,48,72,168])addF(`ret_${hours}h`,diff(lc,H(hours)));
  for(const lag of [1,2,3,4,6,12,24])addF(`ret_1h_lag${lag}`,shift(r1,lag));
  for(const hours of [6,12,24,48,168])addF(`realized_vol_${hours}h`,rollingStd(r1,H(hours)));

  addF("parkinson_24",parkinson(k,H(24)));addF("gk_24",garmanKlass(k,H(24)));
  const atr14e=atrEwm(k,H(14)),atr24e=atrEwm(k,H(24));
  addF("atr_14_rel",safeDivide(atr14e,c));addF("atr_24_rel",safeDivide(atr24e,c));addF("atr_pct_14",safeDivide(atr14e,c));addF("tr_pct",safeDivide(tr,c));
  addF("rsi_14h",rollingRsi(c,H(14),true));addF("rsi_24h",rollingRsi(c,H(24),true));
  const ema12=ema(c,12),ema26=ema(c,26),macdLine=subtract(ema12,ema26),macdSignal=ema(macdLine,9);
  addF("macd",safeDivide(macdLine,c));addF("macd_signal",safeDivide(macdSignal,c));addF("macd_hist",safeDivide(subtract(macdLine,macdSignal),c));
  for(const hours of [6,12,24,48])addF(`roc_${hours}h`,pctChange(c,H(hours)));
  for(const hours of [14,24]){
    const hh=rollingMax(hi,H(hours)),ll=rollingMin(lo,H(hours)),range=subtract(hh,ll);
    addF(`willr_${hours}h`,scaleArray(safeDivide(subtract(hh,c),range,.5),-100));
    addF(`stoch_k_${hours}h`,scaleArray(safeDivide(subtract(c,ll),range,.5),100));
  }
  if(store.wants("cci_20h")){
    const tp=zeros(n);for(let i=0;i<n;i++)tp[i]=(hi[i]+lo[i]+c[i])/3;
    const ma=rollingMean(tp,H(20)),md=rollingMad(tp,H(20)),den=scaleArray(md,.015);addF("cci_20h",safeDivide(subtract(tp,ma),den));
  }
  for(const hours of [9,21,50,100,200]){
    const e=ema(c,H(hours)),a=zeros(n);for(let i=0;i<n;i++)if(finite(e[i]))a[i]=c[i]/e[i]-1;addF(`ema_ratio_${hours}h`,a);
  }
  const ema5=ema(c,5),closeToEma=zeros(n);for(let i=0;i<n;i++)closeToEma[i]=c[i]/ema5[i]-1;addF("close_to_ema5",closeToEma);
  if(store.wants("adx_14h")){
    const period=H(14),plus=zeros(n),minus=zeros(n);plus[0]=0;minus[0]=0;
    for(let i=1;i<n;i++){const up=hi[i]-hi[i-1],dn=lo[i-1]-lo[i];plus[i]=(up>dn&&up>0)?up:0;minus[i]=(dn>up&&dn>0)?dn:0;}
    const atr=ewmAlpha(tr,1/period),pdi=scaleArray(safeDivide(ewmAlpha(plus,1/period),atr),100),mdi=scaleArray(safeDivide(ewmAlpha(minus,1/period),atr),100),dx=zeros(n);
    for(let i=0;i<n;i++)if(finite(pdi[i])&&finite(mdi[i]))dx[i]=(pdi[i]+mdi[i])===0?0:100*Math.abs(pdi[i]-mdi[i])/(pdi[i]+mdi[i]);
    addF("adx_14h",ewmAlpha(dx,1/period));
  }
  for(const hours of [24,72,168]){
    const hh=rollingMax(hi,H(hours)),ll=rollingMin(lo,H(hours)),dh=zeros(n),dl=zeros(n);
    for(let i=0;i<n;i++){if(finite(hh[i]))dh[i]=c[i]/hh[i]-1;if(finite(ll[i]))dl[i]=c[i]/ll[i]-1;}
    addF(`dist_high_${hours}h`,dh);addF(`dist_low_${hours}h`,dl);
  }
  {const period=Math.max(2,H(20)),ma=rollingMean(c,period),sd=rollingStd(c,period),upper=add(ma,scaleArray(sd,2)),lower=subtract(ma,scaleArray(sd,2));addF("bb_pctb_20h",safeDivide(subtract(c,lower),subtract(upper,lower),.5));addF("bb_width_20h",safeDivide(subtract(upper,lower),ma));}
  await pause();assertActive();

  progress(.46,"features","Volume, flow and funding");
  addF("log_volume",unary(v,Math.log1p));
  for(const hours of [24,168]){const mean=rollingMean(v,H(hours)),sd=rollingStd(v,H(hours));addF(`vol_z_${hours}`,clip(safeDivide(subtract(v,mean),sd),-10,10));}
  addF("vol_ma_ratio_24h",safeDivide(v,rollingMean(v,H(24)),1));
  const takerRatio=safeDivide(tb,v,.5),imb=zeros(n);for(let i=0;i<n;i++)if(finite(takerRatio[i]))imb[i]=Math.min(1,Math.max(-1,2*takerRatio[i]-1));
  addF("taker_buy_ratio",takerRatio);addF("taker_imbalance",imb);for(const hours of [6,24])addF(`taker_imbalance_ma_${hours}h`,rollingMean(imb,H(hours)));
  if(store.wants("obv_z_168h")){
    const obv=new Float64Array(n);for(let i=1;i<n;i++)obv[i]=obv[i-1]+Math.sign(c[i]-c[i-1])*v[i];addF("obv_z_168h",safeDivide(subtract(obv,rollingMean(obv,H(168))),rollingStd(obv,H(168))));
  }
  if(wants("mfi_14h","vwap_dev_24h","vwap_dev_72h")){
    const tp=zeros(n),mf=zeros(n),pos=zeros(n),neg=zeros(n);for(let i=0;i<n;i++){tp[i]=(hi[i]+lo[i]+c[i])/3;mf[i]=tp[i]*v[i];if(i===0){pos[i]=0;neg[i]=0;}else{pos[i]=tp[i]>tp[i-1]?mf[i]:0;neg[i]=tp[i]<tp[i-1]?mf[i]:0;}}
    const ps=rollingSum(pos,H(14)),ns=rollingSum(neg,H(14));addF("mfi_14h",clip(scaleArray(safeDivide(ps,add(ps,ns),.5),100),0,100));
    for(const hours of [24,72]){const vw=safeDivide(rollingProductSum(tp,v,H(hours)),rollingSum(v,H(hours))),dev=safeDivide(subtract(c,vw),vw);addF(`vwap_dev_${hours}h`,dev);}
  }
  const range=subtract(hi,lo),signedBody=safeDivide(subtract(c,o),range);
  const maxCO=zeros(n),minCO=zeros(n);for(let i=0;i<n;i++){maxCO[i]=Math.max(c[i],o[i]);minCO[i]=Math.min(c[i],o[i]);}
  addF("body_ratio",signedBody);addF("upper_wick",safeDivide(subtract(hi,maxCO),range));addF("lower_wick",safeDivide(subtract(minCO,lo),range));addF("gap_open",subtract(logArray(o),shift(lc,1)));addF("log_trades",unary(trades,Math.log1p));addF("log_avg_trade_size",unary(safeDivide(v,trades),Math.log1p));
  const fundingNames=FULL_FEATURES.filter((x)=>x.startsWith("funding_"));if(store.wantsAny(fundingNames)){const ff=legacyFunding(funding,k.time,H);for(const name of fundingNames)addF(name,ff[name]);}
  const hour=zeros(n),dow=zeros(n);for(let i=0;i<n;i++){const d=new Date(k.time[i]);hour[i]=d.getUTCHours();dow[i]=d.getUTCDay()===0?6:d.getUTCDay()-1;}
  addF("hour_sin",unary(hour,(x)=>Math.sin(2*Math.PI*x/24)));addF("hour_cos",unary(hour,(x)=>Math.cos(2*Math.PI*x/24)));addF("dow_sin",unary(dow,(x)=>Math.sin(2*Math.PI*x/7)));addF("dow_cos",unary(dow,(x)=>Math.cos(2*Math.PI*x/7)));addF("is_weekend",unary(dow,(x)=>x>=5?1:0));addF("is_friday",unary(dow,(x)=>x===4?1:0));
  await pause();assertActive();

  progress(.54,"features","Volatility catalogue");
  for(const hours of [6,24,48,168,336])addF(`rv_${hours}h`,rollingStd(r1,H(hours)));
  for(const hours of [6,48,72,168])addF(`park_${hours}h`,parkinson(k,H(hours)));
  for(const hours of [6,48,168])addF(`gk_${hours}h`,garmanKlass(k,H(hours)));
  for(const hours of [12,48,168])addF(`rs_${hours}h`,rogersSatchell(k,H(hours)));
  addF("atr_14_pct",safeDivide(atr14e,c));addF("atr_48_pct",safeDivide(atrEwm(k,H(48)),c));
  const rv24=rollingStd(r1,H(24)),rv168=rollingStd(r1,H(168)),rv504=rollingStd(r1,H(504));
  addF("rv_short_vs_long_504",safeDivide(rv24,rv504,1));addF("rv_medium_vs_long",safeDivide(rv168,rv504,1));
  if(store.wants("rv24_rank_168"))addF("rv24_rank_168",rollingPriorRank(rv24,Math.max(0,H(168)-1),false));
  if(store.wants("rv24_rank_504"))addF("rv24_rank_504",rollingPriorRank(rv24,Math.max(0,H(504)-1),false));
  addF("vol_of_vol_168",rollingStd(rv24,H(168)));addF("vol_of_vol_504",rollingStd(rv24,H(504)));
  const logRv=unary(rv24,(x)=>Math.log(x+VOL_FLOOR));for(const hours of [12,24,72])addF(`rv_log_change_${hours}h`,diff(logRv,H(hours)));
  {const sigma=rollingStd(r1,H(168)),j=zeros(n);for(let i=0;i<n;i++)if(finite(sigma[i])&&finite(r1[i]))j[i]=absR1[i]>2*sigma[i]?1:0;addF("jumps_2sigma_168h",rollingMean(j,H(168)));}
  for(const hours of [24,168]){const mx=rollingMax(absR1,H(hours)),sd=rollingStd(r1,H(hours)),den=unary(sd,(x)=>Math.max(x,VOL_FLOOR));addF(`max_abs_ret_scaled_${hours}h`,safeDivide(mx,den));}
  for(const hours of [24,72]){
    const win=H(hours),prod=zeros(n);for(let i=1;i<n;i++)if(finite(absR1[i])&&finite(absR1[i-1]))prod[i]=absR1[i]*absR1[i-1];
    const bv=scaleArray(rollingSum(prod,win),Math.PI/2/win),rv2=scaleArray(rollingSum(squareArray(r1),win),1/win);addF(`jump_ratio_${hours}h`,clip(safeDivide(subtract(rv2,bv),rv2),-1,1));
  }
  for(const hours of [24,72,168]){
    const neg=zeros(n),pos=zeros(n);for(let i=0;i<n;i++)if(finite(r1[i])){neg[i]=Math.min(r1[i],0)**2;pos[i]=Math.max(r1[i],0)**2;}
    const nv=rollingMean(neg,H(hours)),pv=rollingMean(pos,H(hours));if(hours===24||hours===72)addF(`neg_var_${hours}h`,unary(nv,(x)=>Math.sqrt(Math.max(0,x))));if(hours===24||hours===168)addF(`pos_var_${hours}h`,unary(pv,(x)=>Math.sqrt(Math.max(0,x))));if(hours===72||hours===168){const ratio=zeros(n);for(let i=0;i<n;i++)if(finite(nv[i])&&finite(pv[i])){const nvi=Math.max(0,nv[i]),pvi=Math.max(0,pv[i]);ratio[i]=(nvi===0&&pvi===0)?1:(pvi===0?100:nvi/pvi);}addF(`semivol_ratio_${hours}h`,clip(unary(ratio,Math.sqrt),0,10));}
  }
  const hlLog=subtract(logArray(hi),logArray(lo));addF("hl_range_mean_24h",rollingMean(hlLog,H(24)));addF("hl_range_mean_168h",rollingMean(hlLog,H(168)));addF("hl_range_max_72h",rollingMax(hlLog,H(72)));addF("hl_range_max_168h",rollingMax(hlLog,H(168)));addF("taker_imbalance_abs_ma_24h",rollingMean(absArray(imb),H(24)));
  await pause();assertActive();

  progress(.61,"features","Bar structure and label-aligned context");
  addF("r1_log",r1);addF("r12_log",diff(lc,12));addF("RSI14",rollingRsi(c,14,false));const atr14=atrSma(k,14);addF("ATR_norm14",safeDivide(atr14,c));addF("body_range_ratio",safeDivide(absArray(subtract(c,o)),range));
  const atr100=atrSma(k,100),hl100=subtract(rollingMax(hi,100),rollingMin(lo,100)),sma20=rollingMean(c,20),std20=rollingStd(c,20),sma50=rollingMean(c,50),std50=rollingStd(c,50),bw20=scaleArray(safeDivide(scaleArray(std20,4),sma20),100),bw50=scaleArray(safeDivide(scaleArray(std50,4),sma50),100),chop=rollingChop(k,100);
  addF("BollBW50",bw50);addF("ATR_ratio100",safeDivide(atr100,c));addF("BW_CHOP100",safeDivide(bw20,chop));addF("ATR_HL_ratio100",safeDivide(atr100,hl100));addF("TrendConsist100",safeDivide(rollingTrendConsistency(c,100,10),c));
  addF("return_5_3",pctChange(c,3));addF("return_60_3",pctChange(c,36));addF("volatility_5",rollingStd(pctChange(c,1),12));addF("mom_5",rollingSum(pctChange(c,1),5));addF("hour",hour);addF("dow",dow);
  addF("dist_ema5_atr",safeDivide(subtract(c,ema5),atr14));addF("rv6_over_rv24",safeDivide(rollingStd(r1,H(6)),rv24,1));addF("body_signed_3",rollingMean(signedBody,3));const wickImb=subtract(safeDivide(subtract(minCO,lo),range),safeDivide(subtract(hi,maxCO),range));addF("wick_imbalance_3",rollingMean(wickImb,3));addF("volume_surge_3",safeDivide(v,rollingMean(v,H(6)),1));addF("taker_imb_sum_6",rollingSum(imb,H(6)));
  if(store.wants("ret_skew_24h")){const sw=Math.max(3,H(24)),sk=rollingSkew(r1,sw),sd=rollingStd(r1,sw);for(let i=0;i<n;i++)if(finite(sd[i])&&sd[i]===0)sk[i]=0;addF("ret_skew_24h",sk);}
  const signs=zeros(n);for(let i=0;i<n;i++)if(finite(r1[i]))signs[i]=Math.sign(r1[i]);addF("sign_persist_12",rollingMean(signs,12));addF("range_efficiency_6",rollingMean(safeDivide(absArray(subtract(c,o)),range),6));addF("trend_r2_12",rollingTrendR2(c,12));addF("dist_high24_atr",safeDivide(subtract(c,rollingMax(hi,H(24))),atr14));addF("dist_low24_atr",safeDivide(subtract(c,rollingMin(lo,H(24))),atr14));

  const btcNames=FULL_FEATURES.filter((x)=>featureGroup(x)==="BTC context");
  if(store.wantsAny(btcNames)){
    if(!context||!btc)throw new Error("BTC context is required for the selected features");
    const contextMin=minutes<=60?minutes:60,market=buildBtcContext(context,btc,contextMin);
    for(const name of btcNames){if(!store.wants(name))continue;addF(name,alignExact(k,context,minutes,contextMin,market[name]));}
  }
  progress(.66,"features",`Computed ${store.columns.size} selected columns`);await pause();assertActive();
}

function optimalActivity(series,recent,history){
  const a=rollingMean(series,recent),b=rollingMean(shift(series,recent),history),out=zeros(series.length);
  for(let i=0;i<out.length;i++){
    if(!finite(a[i])||!finite(b[i]))continue;
    const scale=Math.max(a[i],b[i]);
    const aa=scale===0?0:a[i]/scale,bb=scale===0?0:b[i]/scale;
    out[i]=(aa+bb)===0?0:Math.max(-1,Math.min(1,(aa-bb)/(aa+bb)));
  }
  return out;
}

async function buildOptimalFeatures(k,candle,context,btc,funding,store){
  const nativeMin=INTERVAL_MIN[candle],contextMin=nativeMin<=60?nativeMin:60,H=(hours)=>Math.floor(hours*60/contextMin);
  const ctx=context,n=k.close.length,n1=H(1),n4=H(4),n24=H(24),n7=H(168),lc=logArray(ctx.close),r=diff(lc),r2=squareArray(r);
  const rv={1:unary(rollingSum(r2,n1),(x)=>Math.sqrt(Math.max(0,x))),4:unary(rollingSum(r2,n4),(x)=>Math.sqrt(Math.max(0,x))),24:unary(rollingSum(r2,n24),(x)=>Math.sqrt(Math.max(0,x)))};
  const timed=new Map(),put=(name,a)=>timed.set(name,a),addF=(name,a)=>store.add(name,a);
  await addWorldFeatures(store,k.time,nativeMin,loadWorld);
  progress(.47,"features","Optimal elapsed-time context");
  for(const hours of [1,4,12,24])put(`ret_${hours}h_log_bps`,scaleArray(diff(lc,H(hours)),10000));
  for(const [name,hours,column,wantMax] of [["breakout_high_4h_rv",4,"high",true],["dist_high_24h_rv",24,"high",true],["dist_low_24h_rv",24,"low",false]]){
    const logCol=logArray(ctx[column]),ref=shift(wantMax?rollingMax(logCol,H(hours)):rollingMin(logCol,H(hours)),1),den=unary(rv[hours],(x)=>Math.max(x,VOL_FLOOR));put(name,safeDivide(subtract(lc,ref),den));
  }
  put("efficiency_4h_signed",clip(safeDivide(diff(lc,n4),rollingSum(absArray(r),n4)),-1,1));
  for(const hours of [1,4,24])put(`rv_${hours}h_bps`,scaleArray(rv[hours],10000));
  {const rms4=scaleArray(rv[4],1/Math.sqrt(n4)),rms24=scaleArray(rv[24],1/Math.sqrt(n24)),out=zeros(ctx.close.length);for(let i=0;i<out.length;i++)if(finite(rms4[i])&&finite(rms24[i]))out[i]=Math.log(Math.max(rms4[i],VOL_FLOOR))-Math.log(Math.max(rms24[i],VOL_FLOOR));put("rv_4h_vs_24h_log",out);}
  put("rv_24h_rank_7d",rollingPriorRank(rv[24],n7,true));
  const logwidth=scaleArray(rollingStd(lc,n4),4);put("bb_logwidth_4h_bps",scaleArray(logwidth,10000));put("bb_logwidth_4h_rank_7d",rollingPriorRank(logwidth,n7,true));
  {const neg=zeros(r.length);for(let i=0;i<r.length;i++)if(finite(r[i]))neg[i]=Math.min(r[i],0)**2;put("downside_variation_share_4h",clip(safeDivide(rollingSum(neg,n4),rollingSum(r2,n4),.5),0,1));}
  put("volume_activity_1h",optimalActivity(ctx.volume,n1,n24));put("volume_activity_4h",optimalActivity(ctx.volume,n4,n7));put("trades_activity_1h",optimalActivity(ctx.trades,n1,n24));
  for(const hours of [1,4]){const volume=rollingSum(ctx.volume,H(hours)),buys=rollingSum(ctx.takerBuy,H(hours)),ratio=safeDivide(buys,volume,.5),imb=zeros(r.length);for(let i=0;i<imb.length;i++)if(finite(ratio[i]))imb[i]=Math.max(-1,Math.min(1,2*ratio[i]-1));put(`taker_imbalance_${hours}h`,imb);}
  await pause();assertActive();

  const btcNames=OPTIMAL_FEATURES.filter((x)=>featureGroup(x)==="BTC context");
  if(store.wantsAny(btcNames)){
    if(!btc)throw new Error("BTC context is required for the selected optimal features");
    progress(.54,"features","Optimal BTC regime context");
    const market=buildBtcContext(ctx,btc,contextMin),rb=market.rb;
    for(const hours of [1,4,24])put(`btc_ret_${hours}h_log_bps`,scaleArray(market[`btc_ret_${hours}h`],10000));
    for(const hours of [4,24])put(`relative_btc_ret_${hours}h_log_bps`,scaleArray(market[`relative_ret_btc_${hours}h`],10000));
    put("btc_residual_4h_log_bps",scaleArray(market.btc_residual_4h,10000));put("btc_corr_7d",market.btc_corr_7d);put("btc_beta_7d",market.btc_beta_7d);put("coin_btc_breakout_24h_log_bps",scaleArray(market.coin_btc_breakout_24h,10000));put("btc_rv_4h_bps",scaleArray(unary(rollingSum(squareArray(rb),n4),(x)=>Math.sqrt(Math.max(0,x))),10000));
    const priorSigma=shift(rollingStd(market.residual,n7),n4),zden=scaleArray(unary(priorSigma,(x)=>Math.max(x,VOL_FLOOR)),Math.sqrt(n4));put("btc_residual_4h_z",safeDivide(market.btc_residual_4h,zden));
    const cov1=rollingCovariance(r,rb,n24),vb=rollingVariance(rb,n24),vc=rollingVariance(r,n24),corr1=zeros(r.length);for(let i=0;i<r.length;i++)if(finite(cov1[i])&&finite(vb[i])&&finite(vc[i]))corr1[i]=(vb[i]<=BTC_VARIANCE_FLOOR||vc[i]<=BTC_VARIANCE_FLOOR)?0:Math.max(-1,Math.min(1,cov1[i]/Math.sqrt(vb[i]*vc[i])));put("btc_corr_change_1d_7d",subtract(corr1,market.btc_corr_7d));
  }

  for(const [name,array] of timed){if(store.wants(name))addF(name,alignExact(k,ctx,nativeMin,contextMin,array));}
  progress(.60,"features","Native and completed-hour features");
  const c=k.close,o=k.open,hi=k.high,lo=k.low,ema5=ema(c,5),atr14=atrSma(k,14),atrRel=safeDivide(atr14,c),logC=logArray(c),logE=logArray(ema5),range=subtract(hi,lo),maxCO=zeros(n),minCO=zeros(n);
  for(let i=0;i<n;i++){maxCO[i]=Math.max(c[i],o[i]);minCO[i]=Math.min(c[i],o[i]);}
  addF("ema5_native_logdist_bps",scaleArray(subtract(logC,logE),10000));addF("ema5_native_dist_atr",safeDivide(safeDivide(subtract(c,ema5),c),unary(atrRel,(x)=>Math.max(x,VOL_FLOOR))));addF("ema5_native_slope3_atr",safeDivide(safeDivide(subtract(ema5,shift(ema5,3)),c),unary(atrRel,(x)=>Math.max(x,VOL_FLOOR))));addF("atr14_native_bps",scaleArray(atrRel,10000));addF("atr100_native_bps",scaleArray(safeDivide(atrSma(k,100),c),10000));addF("body_signed_native",clip(safeDivide(subtract(c,o),range),-1,1));addF("wick_imbalance_native",clip(safeDivide(subtract(subtract(minCO,lo),subtract(hi,maxCO)),range),-1,1));
  const hourly=aggregateCompleteHours(ctx,contextMin),hc=hourly.close,hema=ema(hc,20),hatrRel=safeDivide(atrSma(hourly,14),hc),hlog=scaleArray(subtract(logArray(hc),logArray(hema)),10000),hslope=safeDivide(safeDivide(subtract(hema,shift(hema,4)),hc),unary(hatrRel,(x)=>Math.max(x,VOL_FLOOR)));
  addF("ema20_1h_logdist_bps",alignLastReady(k,hourly,hlog,nativeMin));addF("ema20_1h_slope4_atr",alignLastReady(k,hourly,hslope,nativeMin));
  const daySin=zeros(n),dayCos=zeros(n),weekSin=zeros(n),weekCos=zeros(n);for(let i=0;i<n;i++){const d=new Date(k.time[i]+nativeMin*60_000),day=(d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600)/24,dow=d.getUTCDay()===0?6:d.getUTCDay()-1,week=(dow+day)/7;daySin[i]=Math.sin(2*Math.PI*day);dayCos[i]=Math.cos(2*Math.PI*day);weekSin[i]=Math.sin(2*Math.PI*week);weekCos[i]=Math.cos(2*Math.PI*week);}addF("utc_day_sin",daySin);addF("utc_day_cos",dayCos);addF("utc_week_sin",weekSin);addF("utc_week_cos",weekCos);
  if(store.wantsAny(["funding_mean_24h_bps","funding_paid_24h_bps"])){const ff=optimalFunding(funding,k.time);addF("funding_mean_24h_bps",ff.funding_mean_24h_bps);addF("funding_paid_24h_bps",ff.funding_paid_24h_bps);}
  progress(.66,"features",`Computed ${store.columns.size} selected columns`);await pause();assertActive();
}

// ---------------------------------------------------------------------------
// CSV assembly and GL1F quantization audit
// ---------------------------------------------------------------------------
function formatUtc(ms){return new Date(ms).toISOString().replace("T"," ").replace(".000Z","+00:00");}
function cleanNumber(x){
  if(Object.is(x,-0))return "0";
  return Number(x).toString();
}
function dateStamp(ms){const d=new Date(ms),p=(x)=>String(x).padStart(2,"0");return `${p(d.getUTCDate())}-${p(d.getUTCMonth()+1)}-${d.getUTCFullYear()}`;}
function cleanToken(x){return String(x).replace(/[^A-Za-z0-9._-]+/g,"");}

async function assembleCsv(k,store,job,labels){
  progress(.79,"validate","Removing warm-up and auditing GL1F quantization");
  const selected=job.features.filter((name)=>store.columns.has(name));
  if(selected.length!==job.features.length){const missing=job.features.filter((x)=>!store.columns.has(x));throw new Error(`Selected feature was not computed: ${missing[0]}`);}
  let startIndex=lowerBound(k.time,job.startMs),first=-1;
  for(let i=startIndex;i<k.time.length;i++){
    let ok=true;for(const name of selected)if(!finite(store.columns.get(name)[i])){ok=false;break;}
    if(ok){first=i;break;}
  }
  if(first<0){const counts=selected.map((name)=>[name,Array.from(store.columns.get(name).slice(startIndex)).filter((x)=>!finite(x)).length]).sort((a,b)=>b[1]-a[1]).slice(0,6);throw new Error(`No complete feature rows remain. Missing warm-up: ${counts.map(([n,c])=>`${n} (${c})`).join(", ")}`);}
  for(let i=first;i<k.time.length;i++)for(const name of selected)if(!finite(store.columns.get(name)[i]))throw new Error(`Non-warm-up missing value: ${name} at ${new Date(k.time[i]).toISOString()}`);
  const rowIndexes=[];for(let i=first;i<k.time.length;i++)if(labels[i]!==-1)rowIndexes.push(i);
  if(!rowIndexes.length)throw new Error("No rows retain a complete future label window");

  const audits=[];
  for(const name of selected){
    const a=store.columns.get(name);let min=Infinity,max=-Infinity,qMin=Infinity,qMax=-Infinity,maxAbs=0,qHash1=2166136261,qHash2=0;
    for(const i of rowIndexes){const x=a[i];if(!finite(x))throw new Error(`${name} contains NaN or infinity`);min=Math.min(min,x);max=Math.max(max,x);maxAbs=Math.max(maxAbs,Math.abs(x));const f=Math.fround(x),q=Math.round(f*Q);if(!finite(f)||Math.abs(q)>INT_CAP)throw new Error(`${name} is incompatible with scaleQ=${Q.toLocaleString()}`);qMin=Math.min(qMin,q);qMax=Math.max(qMax,q);qHash1=Math.imul(qHash1^(q|0),16777619)>>>0;qHash2=(Math.imul(qHash2,31)+(q|0))>>>0;}
    if(maxAbs>SAFE_ABS)throw new Error(`${name} exceeds the safe magnitude ${SAFE_ABS}`);
    audits.push({name,min,max,qMin,qMax,maxAbs,qHash1,qHash2});
  }
  const duplicateOf=new Map(),byStats=new Map();
  for(const audit of audits){
    if(audit.min===audit.max||audit.qMin===audit.qMax)continue;
    const key=`${audit.qMin}|${audit.qMax}|${audit.qHash1}|${audit.qHash2}`,candidates=byStats.get(key)||[];
    let original=null;
    for(const candidate of candidates){
      const a=store.columns.get(audit.name),b=store.columns.get(candidate);let same=true;
      for(const i of rowIndexes){const qa=Math.round(Math.fround(a[i])*Q),qb=Math.round(Math.fround(b[i])*Q);if(qa!==qb){same=false;break;}}
      if(same){original=candidate;break;}
    }
    if(original)duplicateOf.set(audit.name,original);else{candidates.push(audit.name);byStats.set(key,candidates);}
  }
  const removed=[],kept=[];let largest={name:"",value:0};
  for(const audit of audits){
    let reason="";
    if(audit.min===audit.max)reason="constant";
    else if(audit.qMin===audit.qMax)reason="collapsed at Q=1e6";
    else if(duplicateOf.has(audit.name))reason=`duplicate after Q=1e6 of ${duplicateOf.get(audit.name)}`;
    if(reason)removed.push({name:audit.name,reason});
    else{kept.push(audit.name);if(audit.maxAbs>largest.value)largest={name:audit.name,value:audit.maxAbs};}
  }
  if(!kept.length)throw new Error("Every selected feature is constant after GL1F quantization; choose a wider window or different features");
  const header=["open_time",...kept,"label"],chunks=[header.join(",")+"\n"],preview=[];let buffer="";
  for(let r=0;r<rowIndexes.length;r++){
    const i=rowIndexes[r],fields=[formatUtc(k.time[i])];for(const name of kept)fields.push(cleanNumber(store.columns.get(name)[i]));fields.push(String(labels[i]));const line=fields.join(",")+"\n";buffer+=line;if(r<5)preview.push(fields);
    if(buffer.length>1_000_000){chunks.push(buffer);buffer="";await pause();assertActive();progress(.82+.14*r/rowIndexes.length,"export",`Serializing CSV · ${r.toLocaleString()}/${rowIndexes.length.toLocaleString()} rows`);}
  }
  if(buffer)chunks.push(buffer);const blob=new Blob(chunks,{type:"text/csv;charset=utf-8"});
  let pos=0;for(const i of rowIndexes)if(labels[i]===1)pos++;const neg=rowIndexes.length-pos;
  const preset=job.preset&&["small","optimal","full","all"].includes(job.preset)?job.preset:"custom";
  const filename=`${cleanToken(job.market.symbol)}_${job.exchange}_${job.candle}_${job.direction}_ema${job.basePeriod}_move${cleanToken(job.moveText??job.movePct)}_retrace${cleanToken(job.retraceText??job.retracePct)}_horizon${cleanToken(job.horizonText||`${job.horizonBars}bars`)}_start_${dateStamp(job.startMs)}_${preset}.csv`;
  const featureFamily=job.featureFamily||"legacy";
  const featureVersion=featureFamily==="mixed"?"btc-context-v2 + optimal-context-v3":featureFamily==="optimal"?"optimal-context-v3":"btc-context-v2";
  const firstExportIndex=rowIndexes[0],lastExportIndex=rowIndexes[rowIndexes.length-1],candleMs=INTERVAL_MIN[job.candle]*60_000;
  const nKept=kept.length,mX=new Float32Array(rowIndexes.length*nKept),mY=new Float32Array(rowIndexes.length),mT=new Float64Array(rowIndexes.length),mC=new Float64Array(rowIndexes.length);
  for(let r=0;r<rowIndexes.length;r++){const i=rowIndexes[r];mT[r]=k.time[i];mC[r]=k.close[i];mY[r]=labels[i];for(let j=0;j<nKept;j++)mX[r*nKept+j]=store.columns.get(kept[j])[i];}
  return {matrix:{X:mX,y:mY,times:mT,close:mC,featureNames:kept.slice(),nRows:rowIndexes.length,nFeatures:nKept},blob,filename,preview,header,contract:{schema:"gl1f-dataset-profile/v1",venue:job.market.venue,exchange:job.exchange,quote:job.market.quote,ticker:job.market.ticker,symbol:job.market.symbol,btcContext:job.market.btcSymbol,candle:job.candle,featureFamily,featureVersion,featureSeedStartMs:Number(k.time[0]),sourceFirstCandleOpenMs:Number(k.time[0]),firstCompleteFeatureOpenMs:Number(k.time[first]),requestedStartMs:Number(job.startMs),requestedEndExclusiveMs:Number(job.endMs),exportFirstOpenMs:Number(k.time[firstExportIndex]),exportLastOpenMs:Number(k.time[lastExportIndex]),exportEndExclusiveMs:Number(k.time[lastExportIndex])+candleMs,label:{direction:job.direction,basePeriod:job.basePeriod,movePct:job.movePct,retracePct:job.retracePct,horizonBars:job.horizonBars,horizonText:job.horizonText}},stats:{rows:rowIndexes.length,features:kept.length,requestedFeatures:selected.length,pos,neg,posPct:100*pos/rowIndexes.length,negPct:100*neg/rowIndexes.length,droppedWarmup:first-startIndex,droppedNoFuture:k.time.length-first-rowIndexes.length,firstTime:formatUtc(k.time[firstExportIndex]),lastTime:formatUtc(k.time[lastExportIndex]),largest,removed,tailColumns:[...store.tailColumns].filter((x)=>kept.includes(x)),scaleQ:Q,featureVersion}};
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

function catalogue(exchange = "binance") {
  return ALL_FEATURES.map((name) => ({
    name,
    group: featureGroup(name),
    note: featureNote(name),
    inSmall: SMALL_FEATURES.includes(name),
    inFull: FULL_SET.has(name),
    inOptimal: OPTIMAL_SET.has(name),
    funding: FUNDING_SET.has(name),
    requires: featureRequirement(name),
    available: featureAvailable(name, exchange),
  }));
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

function exchangeById(id) {
  const ex = EXCHANGES[String(id || "").toLowerCase()];
  if (!ex) throw new Error("Choose Binance or Coinbase");
  return ex;
}

function resolveMarket(exchange, raw) {
  const text = String(raw || "").trim().toUpperCase();
  if (exchange === "binance") {
    const ticker = text.replace(/[\s/_-]+/g, "").replace(/USDT$/, "");
    if (!/^[A-Z0-9]{1,20}$/.test(ticker)) throw new Error("Enter a Binance base asset, such as ETH");
    return { exchange, venue: EXCHANGES.binance.venue, ticker, quote: "USDT", symbol: `${ticker}USDT`, btcSymbol: "BTCUSDT" };
  }
  if (exchange === "coinbase") {
    const parts = text.split(/[\s/_-]+/).filter(Boolean);
    const base = parts[0] || "", quote = parts[1] || "USD";
    if (!/^[A-Z0-9]{1,20}$/.test(base) || !/^[A-Z0-9]{2,10}$/.test(quote) || parts.length > 2) {
      throw new Error("Enter a Coinbase product, such as ETH-USD");
    }
    const btcQuote = ["USD", "USDT", "EUR", "GBP"].includes(quote) ? quote : "USD";
    return { exchange, venue: EXCHANGES.coinbase.venue, ticker: base, quote, symbol: `${base}-${quote}`, btcSymbol: `BTC-${btcQuote}` };
  }
  if (exchange === "hyperliquid") {
    let coin = String(raw || "").trim().replace(/[\s/_-]+(PERP|USDC|USD)$/i, "").replace(/[\s/_-]+/g, "");
    if (/^1000[A-Za-z0-9]+$/.test(coin)) coin = `k${coin.slice(4).toUpperCase()}`;
    else if (!/^k[A-Z0-9]+$/.test(coin)) coin = coin.toUpperCase();
    if (!/^k?[A-Z0-9]{1,20}$/.test(coin)) throw new Error("Enter a Hyperliquid perp coin, such as ETH or kPEPE");
    return { exchange, venue: EXCHANGES.hyperliquid.venue, ticker: coin, quote: "USD", symbol: coin, btcSymbol: "BTC" };
  }
  throw new Error("Choose Binance, Coinbase or Hyperliquid");
}
function assertVenueInterval(ex, interval) {
  if (ex.id === "hyperliquid" && INTERVAL_MIN[interval] < HYPERLIQUID_MIN_MINUTES) {
    throw new Error("Hyperliquid serves only its latest 5,000 candles per size. Below 15m that is shorter than the 22-day indicator warm-up, so choose 15m or larger.");
  }
}

// Coinbase publishes 1m, 5m, 15m, 1h, 6h and 1d buckets; Hyperliquid everything except 6h. Other
// intervals are aggregated from the largest native bucket that divides them exactly.
function nativeInterval(exchange, interval) {
  const list = EXCHANGES[exchange]?.nativeMinutes;
  if (!list) return interval;
  const minutes = INTERVAL_MIN[interval];
  const base = list.find((m) => m <= minutes && minutes % m === 0);
  if (!base) throw new Error(`${EXCHANGES[exchange].name} cannot form ${interval} candles`);
  return MINUTES_TO_INTERVAL[base];
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function apiGet(ex, path, params, signal, retries = 6) {
  let last;
  for (let attempt = 0; attempt < retries; attempt++) {
    assertActive();
    let retryAfterMs = 0;
    try {
      const url = new URL(path, ex.base);
      Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      const response = await fetch(url, { method: "GET", credentials: "omit", signal });
      if (response.ok) return await response.json();
      let detail = "";
      try { const body = await response.json(); detail = body?.msg || body?.message || ""; } catch {}
      const error = new Error(`${ex.short} HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      error.status = response.status;
      if ([401, 403, 404, 418, 451].includes(response.status)) throw error;
      if (response.status !== 429 && response.status < 500) throw error;
      const header = Number(response.headers.get("retry-after"));
      if (Number.isFinite(header) && header > 0) retryAfterMs = Math.min(60_000, header * 1000);
      last = error;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      last = error;
      if (error?.status && error.status !== 429 && error.status < 500) throw error;
    }
    if (attempt < retries - 1) {
      const wait = Math.max(retryAfterMs, Math.min(12_000, 600 * 2 ** attempt) + Math.random() * 250);
      post("log", { level: "warn", message: `${ex.short} request retry ${attempt + 1}/${retries - 1} in ${(wait / 1000).toFixed(1)}s` });
      await pauseAbortable(wait, signal);
    }
  }
  const e = new Error(`${ex.short} request failed after ${retries} attempts: ${last?.message || "network or CORS error"}`);
  e.cause = last;
  throw e;
}

async function apiPost(ex, path, payload, signal, retries = 4) {
  let last;
  for (let attempt = 0; attempt < retries; attempt++) {
    assertActive();
    let retryAfterMs = 0;
    try {
      const response = await fetch(new URL(path, ex.base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "omit", signal });
      if (response.ok) return await response.json();
      let detail = "";
      try {
        const text = (await response.text()).trim();
        try { const body = JSON.parse(text); detail = typeof body === "string" ? body : body?.error || body?.message || text; } catch { detail = text; }
      } catch {}
      detail = String(detail || "").replace(/\s+/g, " ").slice(0, 180);
      const error = new Error(`${ex.short} HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      error.status = response.status;
      if (response.status !== 429 && response.status < 500) throw error;
      const header = Number(response.headers.get("retry-after"));
      if (Number.isFinite(header) && header > 0) retryAfterMs = Math.min(60_000, header * 1000);
      last = error;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      last = error;
      if (error?.status && error.status !== 429 && error.status < 500) throw error;
    }
    if (attempt < retries - 1) {
      const wait = Math.max(retryAfterMs, Math.min(12_000, 600 * 2 ** attempt) + Math.random() * 250);
      post("log", { level: "warn", message: `${ex.short} request retry ${attempt + 1}/${retries - 1} in ${(wait / 1000).toFixed(1)}s` });
      await pauseAbortable(wait, signal);
    }
  }
  const e = new Error(`${ex.short} request failed after ${retries} attempts: ${last?.message || "network or CORS error"}`);
  e.cause = last;
  throw e;
}

// Hyperliquid has no time endpoint. The open time of the minute candle in progress is a conservative
// lower bound for its clock, found without trusting the browser clock.
let hyperliquidClock = NaN;
async function hyperliquidServerTime(ex, signal) {
  // The device clock only bounds the probe window (±days); the answer comes from Hyperliquid's own candles.
  const anchor = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const hours = await apiPost(ex, "/info", { type: "candleSnapshot", req: { coin: "BTC", interval: "1h", startTime: anchor - 10 * 24 * HOUR_MS, endTime: anchor + 2 * 24 * HOUR_MS } }, signal);
  const day = Array.isArray(hours) && hours.length ? Math.max(...hours.map((r) => Number(r.t))) : NaN;
  if (!finite(day)) throw new Error("Hyperliquid returned no recent BTC candles to read its clock from. Check that this device's date is correct.");
  const minutes = await apiPost(ex, "/info", { type: "candleSnapshot", req: { coin: "BTC", interval: "1m", startTime: day, endTime: day + 3 * HOUR_MS } }, signal);
  const minute = Array.isArray(minutes) && minutes.length ? Math.max(...minutes.map((r) => Number(r.t))) : NaN;
  if (!finite(minute) || minute < day) throw new Error("Hyperliquid returned an invalid clock");
  hyperliquidClock = minute;
  return minute;
}

async function serverTime(ex, signal) {
  if (ex.id === "hyperliquid") return hyperliquidServerTime(ex, signal);
  if (ex.id === "binance") {
    const data = await apiGet(ex, "/fapi/v1/time", {}, signal);
    const t = Number(data?.serverTime);
    if (!finite(t)) throw new Error("Binance returned an invalid server time");
    return t;
  }
  const data = await apiGet(ex, "/time", {}, signal);
  const t = Math.floor(Number(data?.epoch) * 1000);
  if (!finite(t)) throw new Error("Coinbase returned an invalid server time");
  return t;
}

async function fetchMarkets(exchangeId) {
  const ex = exchangeById(exchangeId), controller = new AbortController();
  if (ex.id === "binance") {
    const data = await apiGet(ex, "/fapi/v1/exchangeInfo", {}, controller.signal, 3);
    const markets = (data?.symbols || [])
      .filter((s) => s.status === "TRADING" && s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && !String(s.underlyingType || "").includes("TRADIFI"))
      .map((s) => ({ symbol: s.symbol, value: s.baseAsset, base: s.baseAsset, quote: "USDT", listedMs: Number(s.onboardDate) || null }))
      .sort((a, b) => a.base.localeCompare(b.base));
    return { exchange: ex.id, markets };
  }
  if (ex.id === "hyperliquid") {
    const data = await apiPost(ex, "/info", { type: "meta" }, controller.signal, 3);
    const markets = (Array.isArray(data?.universe) ? data.universe : [])
      .filter((m) => m && m.name && !m.isDelisted)
      .map((m) => ({ symbol: String(m.name), value: String(m.name), base: String(m.name), quote: "USD", listedMs: null }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return { exchange: ex.id, markets };
  }
  const data = await apiGet(ex, "/products", {}, controller.signal, 3);
  const markets = (Array.isArray(data) ? data : [])
    .filter((p) => String(p.status || "").toLowerCase() === "online" && !p.trading_disabled && !p.auction_mode)
    .map((p) => ({ symbol: String(p.id), value: String(p.id), base: String(p.base_currency), quote: String(p.quote_currency), listedMs: null }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { exchange: ex.id, markets };
}

// ---------------------------------------------------------------------------
// Candle rows
//   Binance row  : [open, o, h, l, c, volume, closeTime, quoteVolume, trades, takerBase, takerQuote]
//   Coinbase row : [open, o, h, l, c, volume, synthetic]  (synthetic = 1 for a filled no-trade bucket)
// ---------------------------------------------------------------------------

function seriesKey(ex, symbol, interval) {
  return `${ex.schema}:${String(symbol).toUpperCase()}:${interval}`;
}

function canonicalRow(ex, row) {
  if (!Array.isArray(row) || row.length < ex.width) throw new Error(`${ex.short} returned a malformed candle row`);
  const out = row.slice(0, ex.width).map(Number);
  if (!out.every(finite)) throw new Error(`${ex.short} returned a non-finite candle value`);
  return out;
}

function sameRow(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function completedRangeEnd(endMs, stepMs) {
  return Math.floor(Number(endMs) / stepMs) * stepMs;
}

function missingCandleRanges(times, startMs, endExclusiveMs, stepMs) {
  if (!finite(startMs) || !finite(endExclusiveMs) || !finite(stepMs) || stepMs <= 0 || startMs % stepMs !== 0 || endExclusiveMs % stepMs !== 0 || endExclusiveMs < startMs) {
    throw new Error("Invalid candle-cache range");
  }
  const sorted = [...new Set(Array.from(times || [], Number).filter((time) => finite(time) && time >= startMs && time < endExclusiveMs && time % stepMs === 0))].sort((a, b) => a - b);
  const missing = []; let cursor = startMs;
  for (const time of sorted) {
    if (time < cursor) continue;
    if (time > cursor) missing.push([cursor, time]);
    cursor = time + stepMs;
  }
  if (cursor < endExclusiveMs) missing.push([cursor, endExclusiveMs]);
  return missing;
}

function mergeCoverageSegments(segments, next) {
  const all = [...(Array.isArray(segments) ? segments : []), next]
    .map((segment) => [Number(segment[0]), Number(segment[1])])
    .filter(([start, end]) => finite(start) && finite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const segment of all) {
    const last = merged[merged.length - 1];
    if (!last || segment[0] > last[1]) merged.push(segment.slice());
    else last[1] = Math.max(last[1], segment[1]);
  }
  return merged;
}

function parseBinanceRows(rows, interval, label = "market") {
  const n = rows.length, step = INTERVAL_MIN[interval] * 60_000, out = emptyCandles(n);
  for (let i = 0; i < n; i++) {
    const r = rows[i], values = [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5]), Number(r[6]), Number(r[7]), Number(r[8]), Number(r[9]), Number(r[10])];
    if (!values.every(finite)) throw new Error(`${label}: non-finite candle field at row ${i}`);
    const [t, o, h, l, c, v, closeTime, q, trades, taker, takerQuote] = values;
    out.time[i] = t; out.open[i] = o; out.high[i] = h; out.low[i] = l; out.close[i] = c; out.volume[i] = v;
    out.closeTime[i] = closeTime; out.quoteVolume[i] = q; out.trades[i] = trades; out.takerBuy[i] = taker; out.takerQuote[i] = takerQuote;
    if (i && t - out.time[i - 1] !== step) throw new Error(`${label}: missing or irregular ${interval} candle between ${new Date(out.time[i - 1]).toISOString()} and ${new Date(t).toISOString()}`);
    if (t % step !== 0) throw new Error(`${label}: candle at ${new Date(t).toISOString()} is off the UTC interval grid`);
    if (closeTime !== t + step - 1) throw new Error(`${label}: candle at ${new Date(t).toISOString()} has an invalid close time`);
    const tol = Math.max(1e-10, Math.abs(v) * 1e-10);
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < Math.max(o, c) || l > Math.min(o, c) || h < l || v < 0 || q < 0 || trades < 0 || trades !== Math.floor(trades) || taker < 0 || taker > v + tol || takerQuote < 0 || takerQuote > q + Math.max(1e-10, Math.abs(q) * 1e-10) || (v > 0 && trades === 0)) {
      throw new Error(`${label}: invalid OHLC/flow values at ${new Date(t).toISOString()}`);
    }
  }
  return out;
}

function parseCoinbaseRows(rows, interval, label = "market") {
  const n = rows.length, step = INTERVAL_MIN[interval] * 60_000, out = emptyCandles(n);
  out.trades.fill(NaN); out.takerBuy.fill(NaN); out.takerQuote.fill(NaN); out.quoteVolume.fill(NaN);
  for (let i = 0; i < n; i++) {
    const r = rows[i], t = Number(r[0]), o = Number(r[1]), h = Number(r[2]), l = Number(r[3]), c = Number(r[4]), v = Number(r[5]), s = Number(r[6]);
    if (![t, o, h, l, c, v, s].every(finite)) throw new Error(`${label}: non-finite candle field at row ${i}`);
    if (i && t - out.time[i - 1] !== step) throw new Error(`${label}: missing or irregular ${interval} candle between ${new Date(out.time[i - 1]).toISOString()} and ${new Date(t).toISOString()}`);
    if (t % step !== 0) throw new Error(`${label}: candle at ${new Date(t).toISOString()} is off the UTC interval grid`);
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < Math.max(o, c) || l > Math.min(o, c) || v < 0 || (s !== 0 && s !== 1)) {
      throw new Error(`${label}: invalid OHLC values at ${new Date(t).toISOString()}`);
    }
    out.time[i] = t; out.open[i] = o; out.high[i] = h; out.low[i] = l; out.close[i] = c; out.volume[i] = v;
    out.closeTime[i] = t + step - 1; out.synthetic[i] = s;
  }
  return out;
}

function emptyCandles(n) {
  return {
    time: new Float64Array(n), open: new Float64Array(n), high: new Float64Array(n), low: new Float64Array(n),
    close: new Float64Array(n), volume: new Float64Array(n), closeTime: new Float64Array(n), quoteVolume: new Float64Array(n),
    trades: new Float64Array(n), takerBuy: new Float64Array(n), takerQuote: new Float64Array(n), synthetic: new Uint8Array(n),
  };
}

function parseHyperliquidRows(rows, interval, label = "market") {
  const n = rows.length, step = INTERVAL_MIN[interval] * 60_000, out = emptyCandles(n);
  out.takerBuy.fill(NaN); out.takerQuote.fill(NaN); out.quoteVolume.fill(NaN);
  for (let i = 0; i < n; i++) {
    const r = rows[i], t = Number(r[0]), o = Number(r[1]), h = Number(r[2]), l = Number(r[3]), c = Number(r[4]), v = Number(r[5]), trades = Number(r[6]), s = Number(r[7]);
    if (![t, o, h, l, c, v, trades, s].every(finite)) throw new Error(`${label}: non-finite candle field at row ${i}`);
    if (i && t - out.time[i - 1] !== step) throw new Error(`${label}: missing or irregular ${interval} candle between ${new Date(out.time[i - 1]).toISOString()} and ${new Date(t).toISOString()}`);
    if (t % step !== 0) throw new Error(`${label}: candle at ${new Date(t).toISOString()} is off the UTC interval grid`);
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0 || h < Math.max(o, c) || l > Math.min(o, c) || v < 0 || trades < 0 || trades !== Math.floor(trades) || (s !== 0 && s !== 1)) {
      throw new Error(`${label}: invalid OHLC values at ${new Date(t).toISOString()}`);
    }
    out.time[i] = t; out.open[i] = o; out.high[i] = h; out.low[i] = l; out.close[i] = c; out.volume[i] = v;
    out.trades[i] = trades; out.closeTime[i] = t + step - 1; out.synthetic[i] = s;
  }
  return out;
}

function parseRows(ex, rows, interval, label) {
  if (ex.id === "binance") return parseBinanceRows(rows, interval, label);
  if (ex.id === "hyperliquid") return parseHyperliquidRows(rows, interval, label);
  return parseCoinbaseRows(rows, interval, label);
}

// Aggregate filled Coinbase buckets into complete, UTC-aligned coarser candles.
function aggregateCandles(k, baseInterval, interval) {
  const baseMs = INTERVAL_MIN[baseInterval] * 60_000, stepMs = INTERVAL_MIN[interval] * 60_000, need = stepMs / baseMs;
  if (!Number.isInteger(need) || need < 1) throw new Error(`Cannot aggregate ${baseInterval} into ${interval}`);
  if (need === 1) return k;
  const groups = [];
  let current = null;
  for (let i = 0; i < k.time.length; i++) {
    const start = Math.floor(k.time[i] / stepMs) * stepMs;
    if (!current || current.start !== start) {
      current = { start, count: 0, open: k.open[i], high: -Infinity, low: Infinity, close: NaN, volume: 0, trades: 0, tradesKnown: true, synthetic: 1 };
      groups.push(current);
    }
    current.count++;
    current.high = Math.max(current.high, k.high[i]);
    current.low = Math.min(current.low, k.low[i]);
    current.close = k.close[i];
    current.volume += k.volume[i];
    if (finite(k.trades[i])) current.trades += k.trades[i]; else current.tradesKnown = false;
    if (!k.synthetic[i]) current.synthetic = 0;
  }
  const complete = groups.filter((g) => g.count === need), out = emptyCandles(complete.length);
  out.trades.fill(NaN); out.takerBuy.fill(NaN); out.takerQuote.fill(NaN); out.quoteVolume.fill(NaN);
  complete.forEach((g, i) => {
    out.time[i] = g.start; out.open[i] = g.open; out.high[i] = g.high; out.low[i] = g.low; out.close[i] = g.close;
    out.volume[i] = g.volume; out.closeTime[i] = g.start + stepMs - 1; out.synthetic[i] = g.synthetic;
    out.trades[i] = g.tradesKnown ? g.trades : NaN;
  });
  for (let i = 1; i < out.time.length; i++) {
    if (out.time[i] - out.time[i - 1] !== stepMs) throw new Error(`Aggregated ${interval} candles are not contiguous`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Local candle cache (IndexedDB, session memory fallback). Raw candles only.
// ---------------------------------------------------------------------------

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Browser candle cache request failed"));
  });
}
function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Browser candle cache transaction failed"));
  });
}
async function openCandleDb() {
  if (candleDbPromise) return candleDbPromise;
  if (!globalThis.indexedDB || !globalThis.IDBKeyRange) {
    candleDbMode = "session-memory";
    candleDbPromise = Promise.resolve(null);
    return candleDbPromise;
  }
  candleDbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(CANDLE_CACHE_DB, CANDLE_CACHE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("candles")) db.createObjectStore("candles", { keyPath: ["series", "openTime"] });
      if (!db.objectStoreNames.contains("series")) db.createObjectStore("series", { keyPath: "series" });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => db.close();
      candleDbMode = "indexeddb";
      resolve(db);
    };
    request.onerror = request.onblocked = () => {
      if (settled) return;
      settled = true;
      candleDbMode = "session-memory";
      resolve(null);
    };
  });
  return candleDbPromise;
}
function candleKeyRange(series, startMs = 0, endExclusiveMs = Number.MAX_SAFE_INTEGER) {
  return IDBKeyRange.bound([series, startMs], [series, endExclusiveMs], false, true);
}
async function readCachedRows(series, startMs, endExclusiveMs) {
  if (endExclusiveMs <= startMs) return [];
  const db = await openCandleDb();
  if (!db) {
    const map = memoryCandles.get(series);
    if (!map) return [];
    return [...map.entries()].filter(([time]) => time >= startMs && time < endExclusiveMs).sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  }
  const transaction = db.transaction("candles", "readonly");
  const records = await idbRequest(transaction.objectStore("candles").getAll(candleKeyRange(series, startMs, endExclusiveMs)));
  await idbTransactionDone(transaction);
  return records.map((record) => record.row);
}
async function readCachedTimes(series, startMs, endExclusiveMs) {
  if (endExclusiveMs <= startMs) return [];
  const db = await openCandleDb();
  if (!db) {
    const map = memoryCandles.get(series);
    return map ? [...map.keys()].filter((time) => time >= startMs && time < endExclusiveMs) : [];
  }
  const transaction = db.transaction("candles", "readonly");
  const keys = await idbRequest(transaction.objectStore("candles").getAllKeys(candleKeyRange(series, startMs, endExclusiveMs)));
  await idbTransactionDone(transaction);
  return keys.map((key) => Number(key[1]));
}
async function readSeriesMeta(series) {
  const db = await openCandleDb();
  if (!db) return memorySeriesMeta.get(series) || null;
  const transaction = db.transaction("series", "readonly");
  const value = await idbRequest(transaction.objectStore("series").get(series));
  await idbTransactionDone(transaction);
  return value || null;
}
async function writeCachedRows(ex, symbol, interval, rows) {
  if (!rows.length || candleCacheWriteFailed) return false;
  const series = seriesKey(ex, symbol, interval), stepMs = INTERVAL_MIN[interval] * 60_000;
  const canonical = rows.map((row) => canonicalRow(ex, row)).sort((a, b) => a[0] - b[0]);
  parseRows(ex, canonical, interval, `${symbol} ${interval} cache write`);
  const db = await openCandleDb();
  const first = canonical[0][0], end = canonical[canonical.length - 1][0] + stepMs;
  if (!db) {
    let map = memoryCandles.get(series); if (!map) { map = new Map(); memoryCandles.set(series, map); }
    for (const row of canonical) map.set(row[0], row);
    const previous = memorySeriesMeta.get(series);
    memorySeriesMeta.set(series, {
      series, schema: ex.schema, exchange: ex.id, symbol, interval, stepMs,
      segments: mergeCoverageSegments(previous?.segments, [first, end]),
      firstOpen: Math.min(previous?.firstOpen ?? first, first), lastOpen: Math.max(previous?.lastOpen ?? first, end - stepMs),
      count: map.size, updatedAt: Date.now(), backend: "session-memory", availableFrom: previous?.availableFrom,
    });
    return true;
  }
  try {
    let previous = await readSeriesMeta(series);
    for (let offset = 0; offset < canonical.length; offset += CANDLE_CACHE_BATCH) {
      assertActive();
      const batch = canonical.slice(offset, offset + CANDLE_CACHE_BATCH), bFirst = batch[0][0], bEnd = batch[batch.length - 1][0] + stepMs;
      const meta = {
        series, schema: ex.schema, exchange: ex.id, symbol, interval, stepMs,
        segments: mergeCoverageSegments(previous?.segments, [bFirst, bEnd]),
        firstOpen: Math.min(previous?.firstOpen ?? bFirst, bFirst), lastOpen: Math.max(previous?.lastOpen ?? bFirst, bEnd - stepMs),
        count: Number(previous?.count) || 0, updatedAt: Date.now(), backend: "indexeddb", availableFrom: previous?.availableFrom,
      };
      const transaction = db.transaction(["candles", "series"], "readwrite"), store = transaction.objectStore("candles"), metaStore = transaction.objectStore("series");
      for (const row of batch) store.put({ series, openTime: row[0], row });
      const countRequest = store.count(candleKeyRange(series));
      countRequest.onsuccess = () => { meta.count = Number(countRequest.result) || 0; metaStore.put(meta); };
      await idbTransactionDone(transaction);
      previous = meta;
    }
    return true;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    candleCacheWriteFailed = true;
    post("log", { level: "warn", message: `Candle cache could not save new candles (${error?.name || "storage error"}). The build continues.` });
    return false;
  }
}
async function markSeriesAvailableFrom(ex, symbol, interval, availableFrom) {
  const stepMs = INTERVAL_MIN[interval] * 60_000, time = Number(availableFrom), series = seriesKey(ex, symbol, interval);
  if (!finite(time) || time % stepMs !== 0) return false;
  const db = await openCandleDb();
  if (!db) {
    const meta = memorySeriesMeta.get(series); if (!meta) return false;
    meta.availableFrom = Math.min(finite(meta.availableFrom) ? meta.availableFrom : time, time);
    return true;
  }
  const transaction = db.transaction("series", "readwrite"), store = transaction.objectStore("series"), request = store.get(series);
  request.onsuccess = () => {
    const meta = request.result;
    if (!meta) return;
    meta.availableFrom = Math.min(finite(meta.availableFrom) ? meta.availableFrom : time, time);
    meta.updatedAt = Date.now();
    store.put(meta);
  };
  await idbTransactionDone(transaction);
  return true;
}
async function inspectCandleCache() {
  const db = await openCandleDb(); let items;
  if (!db) items = [...memorySeriesMeta.values()];
  else {
    const transaction = db.transaction("series", "readonly");
    items = await idbRequest(transaction.objectStore("series").getAll());
    await idbTransactionDone(transaction);
  }
  const rows = items.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  return { backend: candleDbMode, persistent: candleDbMode === "indexeddb", series: items.length, rows, approxBytes: rows * 96 };
}
async function clearCandleCache(series = null) {
  const db = await openCandleDb();
  if (!series) {
    memoryCandles.clear(); memorySeriesMeta.clear(); candleCacheWriteFailed = false;
    if (db) {
      const transaction = db.transaction(["candles", "series"], "readwrite");
      transaction.objectStore("candles").clear(); transaction.objectStore("series").clear();
      await idbTransactionDone(transaction);
    }
    return;
  }
  memoryCandles.delete(series); memorySeriesMeta.delete(series);
  if (db) {
    const transaction = db.transaction(["candles", "series"], "readwrite");
    transaction.objectStore("candles").delete(candleKeyRange(series));
    transaction.objectStore("series").delete(series);
    await idbTransactionDone(transaction);
  }
}

// ---------------------------------------------------------------------------
// Network ranges
// ---------------------------------------------------------------------------

// Runs fn over items with up to ex.parallel requests in flight, starting one at most every ex.intervalMs, so a long
// history downloads several pages at a time while staying well inside the exchange's rate limits.
async function mapPaced(items, ex, signal, fn) {
  const parallel = Math.max(1, Math.min(ex.parallel || 1, items.length)), interval = ex.intervalMs ?? ex.pauseMs ?? 0;
  let next = 0, lastStart = -Infinity, failed = null;
  const worker = async () => {
    while (next < items.length && !failed) {
      const i = next++;
      const slot = Math.max(Date.now(), lastStart + interval);
      lastStart = slot;
      if (slot > Date.now()) await pauseAbortable(slot - Date.now(), signal);
      assertActive();
      try { await fn(items[i], i); } catch (error) { failed = failed || error; throw error; }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}

// Binance: fixed one-page windows fetched several at a time (about 1,760 of the 2,400 request weight per minute at
// 1,000 candles per request). The merged candles are exactly those page-by-page pagination returns.
async function fetchBinanceRange(ex, symbol, interval, startMs, endExclusiveMs, signal, label, progressRange) {
  const candleMs = INTERVAL_MIN[interval] * 60_000;
  if (endExclusiveMs <= startMs) return { rows: [], requests: 0 };
  const span = ex.pageRows * candleMs, windows = [];
  for (let a = startMs; a < endExclusiveMs; a += span) windows.push([a, Math.min(endExclusiveMs, a + span)]);
  const byTime = new Map(); let done = 0;
  await mapPaced(windows, ex, signal, async ([a, b]) => {
    const responseRows = await apiGet(ex, "/fapi/v1/klines", { symbol, interval, startTime: a, endTime: b - 1, limit: ex.pageRows }, signal);
    if (!Array.isArray(responseRows)) throw new Error(`Unexpected ${label} candle response`);
    for (const raw of responseRows) {
      const row = canonicalRow(ex, raw), t = row[0];
      if (t < a || t >= b || row[6] >= endExclusiveMs) continue;
      if (t % candleMs !== 0) throw new Error(`${label}: off-grid candle returned at ${new Date(t).toISOString()}`);
      if (byTime.has(t) && !sameRow(byTime.get(t), row)) throw new Error(`${label}: conflicting duplicate candle at ${new Date(t).toISOString()}`);
      byTime.set(t, row);
    }
    done++;
    progress(progressRange[0] + (progressRange[1] - progressRange[0]) * Math.min(0.98, done / windows.length), "fetch", `${label}: ${byTime.size.toLocaleString()} candles`);
  });
  return { rows: [...byTime.values()].sort((a, b) => a[0] - b[0]), requests: windows.length };
}

// Real (traded) Coinbase buckets inside [startMs, endExclusiveMs), keyed by open time.
async function fetchCoinbaseTraded(ex, product, interval, startMs, endExclusiveMs, signal, label, progressRange, stats) {
  const stepMs = INTERVAL_MIN[interval] * 60_000, granularity = stepMs / 1000, span = ex.pageRows * stepMs;
  // Fixed windows fetched several at a time (under Coinbase's 10 public requests per second).
  const windows = [];
  for (let a = startMs; a < endExclusiveMs; a += span) windows.push(a);
  const byTime = new Map(); let done = 0;
  await mapPaced(windows, ex, signal, async (cursor) => {
    const windowEnd = cursor + span;
    const response = await apiGet(ex, `/products/${encodeURIComponent(product)}/candles`, {
      granularity, start: new Date(cursor).toISOString(), end: new Date(windowEnd).toISOString(),
    }, signal);
    if (!Array.isArray(response)) throw new Error(`Unexpected ${label} candle response`);
    for (const raw of response) {
      if (!Array.isArray(raw) || raw.length < 6) throw new Error(`${label}: malformed Coinbase candle`);
      const t = Number(raw[0]) * 1000;
      let low = Number(raw[1]), high = Number(raw[2]);
      const open = Number(raw[3]), close = Number(raw[4]), volume = Number(raw[5]);
      if (![t, low, high, open, close, volume].every(finite)) throw new Error(`${label}: non-finite Coinbase candle`);
      if (t < startMs || t >= endExclusiveMs) continue;
      if (t % stepMs !== 0) throw new Error(`${label}: off-grid candle returned at ${new Date(t).toISOString()}`);
      if (high < Math.max(open, close) || low > Math.min(open, close)) {
        high = Math.max(high, open, close); low = Math.min(low, open, close);
        if (stats) stats.repaired++;
      }
      byTime.set(t, [t, open, high, low, close, volume, 0]);
    }
    done++;
    progress(progressRange[0] + (progressRange[1] - progressRange[0]) * Math.min(0.98, done / windows.length), "fetch", `${label}: ${byTime.size.toLocaleString()} candles`);
  });
  if (stats) stats.requests += windows.length;
  return byTime;
}

// Coinbase omits buckets without trades. Fill them with the previous close and zero volume.
async function previousCoinbaseClose(ex, product, interval, beforeMs, signal, stats) {
  const stepMs = INTERVAL_MIN[interval] * 60_000;
  const start = beforeMs - ex.pageRows * stepMs;
  if (start < 0) return NaN;
  const traded = await fetchCoinbaseTraded(ex, product, interval, start, beforeMs, signal, `${product} ${interval} anchor`, [0, 0], stats);
  let best = -Infinity, close = NaN;
  for (const [t, row] of traded) if (t > best) { best = t; close = row[4]; }
  return close;
}

function fillCoinbaseRows(traded, startMs, endExclusiveMs, stepMs, previousClose, makeSynthetic = (t, last) => [t, last, last, last, last, 0, 1], venue = "Coinbase") {
  const rows = []; let last = finite(previousClose) ? previousClose : NaN, synthetic = 0, run = 0, runStart = NaN, maxRun = 0;
  for (let t = startMs; t < endExclusiveMs; t += stepMs) {
    const row = traded.get(t);
    if (row) { rows.push(row); last = row[4]; run = 0; continue; }
    if (!finite(last)) continue;
    if (run === 0) runStart = t;
    run++;
    maxRun = Math.max(maxRun, run);
    if (run * stepMs / 60_000 > MAX_FILLED_GAP_MINUTES) {
      throw new Error(`${venue} has no candles for more than ${MAX_FILLED_GAP_MINUTES / 60} hours from ${new Date(runStart).toISOString().slice(0, 16)} UTC. That looks like an outage or a halted market, so it is not filled. Choose a range that avoids it.`);
    }
    rows.push(makeSynthetic(t, last));
    synthetic++;
  }
  return { rows, synthetic, maxGapMinutes: maxRun * stepMs / 60_000 };
}

async function fetchCoinbaseFilled(ex, product, interval, startMs, endExclusiveMs, previousClose, signal, label, progressRange, stats) {
  const stepMs = INTERVAL_MIN[interval] * 60_000;
  const traded = await fetchCoinbaseTraded(ex, product, interval, startMs, endExclusiveMs, signal, label, progressRange, stats);
  let anchor = previousClose;
  if (!finite(anchor) && !traded.has(startMs)) anchor = await previousCoinbaseClose(ex, product, interval, startMs, signal, stats);
  const filled = fillCoinbaseRows(traded, startMs, endExclusiveMs, stepMs, anchor);
  stats.synthetic += filled.synthetic;
  stats.maxGapMinutes = Math.max(stats.maxGapMinutes || 0, filled.maxGapMinutes);
  return filled.rows;
}

// ---------------------------------------------------------------------------
// Cache-aware series loader
// ---------------------------------------------------------------------------

function validateLoadedRange(ex, rows, interval, startMs, endExclusiveMs, label) {
  if (!rows.length) throw new Error(`No completed candles returned for ${label}`);
  const parsed = parseRows(ex, rows, interval, label), stepMs = INTERVAL_MIN[interval] * 60_000;
  const lastExpected = endExclusiveMs - stepMs;
  if (parsed.time[parsed.time.length - 1] !== lastExpected) {
    throw new Error(`${label}: candle history ended early at ${new Date(parsed.time[parsed.time.length - 1]).toISOString()}; expected ${new Date(lastExpected).toISOString()}`);
  }
  if (parsed.time[0] < startMs) throw new Error(`${label}: candle history escaped the requested window`);
  return parsed;
}

async function loadNativeSeries(ex, symbol, interval, startMs, endMs, signal, label, progressRange, cacheEnabled = true, recovering = false) {
  const stepMs = INTERVAL_MIN[interval] * 60_000;
  const rangeStart = Math.ceil(startMs / stepMs) * stepMs;
  const rangeEnd = completedRangeEnd(endMs, stepMs);
  if (rangeEnd <= rangeStart) throw new Error(`No completed candles for ${symbol} ${interval} in this range`);
  const stats = { requests: 0, synthetic: 0, repaired: 0 };
  const series = seriesKey(ex, symbol, interval);

  const fetchRange = async (a, b, previousClose, range) => {
    if (ex.id === "binance") {
      const fetched = await fetchBinanceRange(ex, symbol, interval, a, b, signal, label, range);
      stats.requests += fetched.requests;
      return fetched.rows;
    }
    if (ex.id === "hyperliquid") return fetchHyperliquidFilled(ex, symbol, interval, a, b, previousClose, signal, label, range, stats);
    return fetchCoinbaseFilled(ex, symbol, interval, a, b, previousClose, signal, label, range, stats);
  };

  if (!cacheEnabled) {
    const rows = await fetchRange(rangeStart, rangeEnd, NaN, progressRange);
    const parsed = validateLoadedRange(ex, rows, interval, rangeStart, rangeEnd, label);
    parsed._report = { series, exchange: ex.id, symbol, interval, requiredRows: parsed.time.length, reusedRows: 0, fetchedRows: parsed.time.length, requests: stats.requests, synthetic: stats.synthetic, repaired: stats.repaired, maxGapMinutes: stats.maxGapMinutes || 0, backend: "network", persistent: false };
    return parsed;
  }

  let cachedRows = [], seriesMeta = null, effectiveStart = rangeStart;
  try {
    seriesMeta = await readSeriesMeta(series);
    if (ex.id === "binance" && finite(seriesMeta?.availableFrom) && seriesMeta.availableFrom > effectiveStart) effectiveStart = seriesMeta.availableFrom;
    if (rangeEnd <= effectiveStart) throw new Error(`No completed candles exist for ${symbol} ${interval} in the requested range`);
    cachedRows = (await readCachedRows(series, effectiveStart, rangeEnd)).map((row) => canonicalRow(ex, row)).sort((a, b) => a[0] - b[0]);
    assertActive();
  } catch (error) {
    if (error?.name === "AbortError" || /No completed candles exist/.test(error?.message || "")) throw error;
    post("log", { level: "warn", message: `${label}: cached candles could not be read and will be downloaded again.` });
    try { await clearCandleCache(series); } catch {}
    cachedRows = []; seriesMeta = null; effectiveStart = rangeStart;
  }

  const originalTimes = new Set(cachedRows.map((row) => row[0]));
  const byTime = new Map(cachedRows.map((row) => [row[0], row]));
  const missing = missingCandleRanges(byTime.keys(), effectiveStart, rangeEnd, stepMs);
  const missingBars = missing.reduce((sum, [a, b]) => sum + (b - a) / stepMs, 0);
  let completedBars = 0;
  const freshSegments = [];

  for (const [gapStart, gapEnd] of missing) {
    assertActive();
    const bars = (gapEnd - gapStart) / stepMs;
    const range = [
      progressRange[0] + (progressRange[1] - progressRange[0]) * (missingBars ? completedBars / missingBars : 0),
      progressRange[0] + (progressRange[1] - progressRange[0]) * (missingBars ? (completedBars + bars) / missingBars : 1),
    ];
    const fresh = [];
    if (ex.id === "binance") {
      const requestStart = byTime.has(gapStart - stepMs) ? gapStart - stepMs : gapStart;
      const requestEnd = byTime.has(gapEnd) ? Math.min(rangeEnd, gapEnd + stepMs) : gapEnd;
      const rows = await fetchRange(requestStart, requestEnd, NaN, range);
      for (const row of rows) {
        const t = row[0], existing = byTime.get(t);
        if (existing && !sameRow(existing, row)) throw new Error(`${label}: Binance candle at ${new Date(t).toISOString()} conflicts with the saved copy. Clear cached candles and retry.`);
        if (!existing) byTime.set(t, row);
        if (t >= gapStart && t < gapEnd && !originalTimes.has(t)) fresh.push(row);
      }
    } else {
      const previous = byTime.get(gapStart - stepMs);
      const rows = await fetchRange(gapStart, gapEnd, previous ? previous[4] : NaN, range);
      for (const row of rows) {
        if (row[0] >= gapStart && row[0] < gapEnd && !byTime.has(row[0])) { byTime.set(row[0], row); fresh.push(row); }
      }
    }
    if (fresh.length) freshSegments.push(fresh);
    completedBars += bars;
  }

  const rows = [...byTime.values()].filter((row) => row[0] >= effectiveStart && row[0] < rangeEnd).sort((a, b) => a[0] - b[0]);
  let parsed;
  try {
    parsed = validateLoadedRange(ex, rows, interval, effectiveStart, rangeEnd, label);
  } catch (error) {
    if (cachedRows.length && !recovering) {
      post("log", { level: "warn", message: `${label}: saved candles failed validation; downloading this series again.` });
      await clearCandleCache(series);
      return loadNativeSeries(ex, symbol, interval, rangeStart, rangeEnd, signal, label, progressRange, true, true);
    }
    throw error;
  }

  let cacheSaved = true;
  for (const segment of freshSegments) cacheSaved = await writeCachedRows(ex, symbol, interval, segment) && cacheSaved;
  if (ex.id === "binance") {
    const discovered = missing[0]?.[0] === effectiveStart && parsed.time[0] > effectiveStart ? parsed.time[0] : null;
    if (finite(discovered)) {
      try { cacheSaved = await markSeriesAvailableFrom(ex, symbol, interval, discovered) && cacheSaved; }
      catch (error) { if (error?.name === "AbortError") throw error; cacheSaved = false; }
    }
  }
  assertActive();
  const reusedRows = parsed.time.reduce((count, time) => count + (originalTimes.has(time) ? 1 : 0), 0);
  let syntheticRows = 0;
  for (let i = 0; i < parsed.synthetic.length; i++) syntheticRows += parsed.synthetic[i];
  parsed._report = {
    series, exchange: ex.id, symbol, interval, requiredRows: parsed.time.length, reusedRows, fetchedRows: parsed.time.length - reusedRows,
    requests: stats.requests, synthetic: syntheticRows, repaired: stats.repaired, missingRanges: missing.length, maxGapMinutes: stats.maxGapMinutes || 0,
    backend: candleDbMode, persistent: candleDbMode === "indexeddb", cacheSaved,
  };
  if (!stats.requests) progress(progressRange[1], "fetch", `${label}: ${reusedRows.toLocaleString()} cached candles`);
  return parsed;
}

async function loadCandles(ex, symbol, interval, startMs, endMs, signal, label, progressRange, cacheEnabled) {
  const base = nativeInterval(ex.id, interval);
  if (base === interval) return loadNativeSeries(ex, symbol, interval, startMs, endMs, signal, label, progressRange, cacheEnabled);
  const stepMs = INTERVAL_MIN[interval] * 60_000;
  const alignedStart = Math.ceil(startMs / stepMs) * stepMs, alignedEnd = completedRangeEnd(endMs, stepMs);
  if (alignedEnd <= alignedStart) throw new Error(`No completed candles for ${symbol} ${interval} in this range`);
  const baseCandles = await loadNativeSeries(ex, symbol, base, alignedStart, alignedEnd, signal, `${label} (${base} → ${interval})`, progressRange, cacheEnabled);
  const out = aggregateCandles(baseCandles, base, interval);
  if (!out.time.length) throw new Error(`${label}: no complete ${interval} candles in this range`);
  if (out.time[out.time.length - 1] !== alignedEnd - stepMs) throw new Error(`${label}: the latest ${interval} candle is incomplete`);
  let synthetic = 0;
  for (let i = 0; i < out.synthetic.length; i++) synthetic += out.synthetic[i];
  out._report = { ...baseCandles._report, interval, nativeInterval: base, requiredRows: out.time.length, aggregatedFrom: baseCandles.time.length, synthetic };
  return out;
}

// Hyperliquid candles: only buckets with trades exist, so gaps are filled like Coinbase (previous close,
// zero volume, zero trades), with the same outage cap. Uncached history is limited to the latest 5,000.
async function fetchHyperliquidFilled(ex, coin, interval, startMs, endExclusiveMs, previousClose, signal, label, range, stats) {
  const stepMs = INTERVAL_MIN[interval] * 60_000;
  const clock = finite(hyperliquidClock) ? hyperliquidClock : Date.now();
  const oldest = Math.floor(clock / stepMs) * stepMs - (ex.historyRows - 1) * stepMs;
  if (startMs < oldest + stepMs) {
    const day = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
    throw new Error(`${label}: Hyperliquid only serves its latest ${ex.historyRows.toLocaleString("en-US")} ${interval} candles (back to ${day(oldest + stepMs)} UTC), but this request needs ${interval} candles from ${day(startMs)} UTC, including indicator warm-up. Move the start date later or choose a larger candle.`);
  }
  const traded = new Map(), spanMs = ex.pageRows * stepMs, first = Math.max(oldest, startMs - stepMs);
  for (let a = first, pages = 0; a < endExclusiveMs; pages++) {
    assertActive();
    if (pages > 4 * Math.ceil((endExclusiveMs - first) / (500 * stepMs)) + 8) throw new Error(`${label}: Hyperliquid pagination did not advance`);
    const b = Math.min(endExclusiveMs, a + spanMs);
    const rows = await apiPost(ex, "/info", { type: "candleSnapshot", req: { coin, interval, startTime: a, endTime: b - 1 } }, signal);
    stats.requests++;
    if (!Array.isArray(rows)) throw new Error(`${label}: unexpected Hyperliquid response`);
    let lastT = -Infinity;
    const windowStart = a;
    for (const r of rows) {
      const t = Number(r?.t);
      if (t > lastT && t < b) lastT = t;
      if (!(t >= windowStart && t < b)) continue;
      const row = [t, Number(r.o), Number(r.h), Number(r.l), Number(r.c), Number(r.v), Number(r.n), 0];
      if (!row.every(finite)) throw new Error(`${label}: Hyperliquid returned a non-finite candle value`);
      if (traded.has(t) && !sameRow(traded.get(t), row)) throw new Error(`${label}: conflicting Hyperliquid candles at ${new Date(t).toISOString()}`);
      traded.set(t, row);
    }
    // Continue right after the newest candle returned when the answer stopped short of the window.
    const next = finite(lastT) && lastT >= a && lastT + stepMs < b && rows.length >= 450 ? lastT + stepMs : b;
    progress(range[0] + (range[1] - range[0]) * Math.min(0.98, (next - first) / Math.max(1, endExclusiveMs - first)), "fetch", `${label}: ${traded.size.toLocaleString()} candles`);
    a = next;
    if (a < endExclusiveMs) await pause(ex.pauseMs);
  }
  if (!traded.size) throw new Error(`${label}: Hyperliquid returned no ${interval} candles for ${coin}. Check the coin name (for example ETH or kPEPE).`);
  const before = traded.get(startMs - stepMs);
  const anchor = finite(previousClose) ? previousClose : before ? before[4] : NaN;
  traded.delete(startMs - stepMs);
  const filled = fillCoinbaseRows(traded, startMs, endExclusiveMs, stepMs, anchor, (t, last) => [t, last, last, last, last, 0, 0, 1], "Hyperliquid");
  stats.synthetic += filled.synthetic;
  stats.maxGapMinutes = Math.max(stats.maxGapMinutes || 0, filled.maxGapMinutes);
  return filled.rows;
}

async function fetchHyperliquidFunding(ex, coin, startMs, endMs, signal, progressRange) {
  const byTime = new Map(); let cursor = startMs, page = 0;
  while (cursor < endMs) {
    assertActive();
    const rows = await apiPost(ex, "/info", { type: "fundingHistory", coin, startTime: cursor, endTime: endMs }, signal);
    if (!Array.isArray(rows)) throw new Error("Unexpected Hyperliquid funding response");
    if (!rows.length) break;
    let latest = -Infinity;
    for (const row of rows) {
      const t = Number(row?.time), rate = Number(row?.fundingRate);
      if (!finite(t) || !finite(rate)) throw new Error("Funding contains a non-finite time or rate");
      latest = Math.max(latest, t);
      if (t < startMs || t > endMs) continue;
      if (byTime.has(t) && byTime.get(t) !== rate) throw new Error(`Conflicting funding events at ${new Date(t).toISOString()}`);
      byTime.set(t, rate);
    }
    const next = latest + 1;
    if (!finite(next) || next <= cursor) throw new Error("Funding pagination did not advance");
    cursor = next; page++;
    progress(progressRange[0] + (progressRange[1] - progressRange[0]) * Math.min(0.98, page / 12), "fetch", `Funding: ${byTime.size.toLocaleString()} hourly events`);
    await pause(ex.pauseMs);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  return { time: Float64Array.from(times), rate: Float64Array.from(times.map((t) => byTime.get(t))) };
}

async function fetchFunding(ex, symbol, startMs, endMs, signal, progressRange) {
  if (ex.id === "hyperliquid") return fetchHyperliquidFunding(ex, symbol, startMs, endMs, signal, progressRange);
  const byTime = new Map(); let cursor = startMs, page = 0;
  while (cursor < endMs) {
    assertActive();
    const rows = await apiGet(ex, "/fapi/v1/fundingRate", { symbol, startTime: cursor, endTime: endMs, limit: 1000 }, signal);
    if (!Array.isArray(rows)) throw new Error("Unexpected funding response");
    if (!rows.length) break;
    for (const row of rows) {
      const t = Number(row.fundingTime), rate = Number(row.fundingRate);
      if (!finite(t) || !finite(rate)) throw new Error("Funding contains a non-finite time or rate");
      if (byTime.has(t) && byTime.get(t) !== rate) throw new Error(`Conflicting funding events at ${new Date(t).toISOString()}`);
      byTime.set(t, rate);
    }
    const next = Number(rows[rows.length - 1].fundingTime) + 1;
    if (!finite(next) || next <= cursor) throw new Error("Funding pagination did not advance");
    cursor = next; page++;
    progress(progressRange[0] + (progressRange[1] - progressRange[0]) * Math.min(0.98, page / 3), "fetch", `Funding: ${byTime.size.toLocaleString()} events`);
    await pause(80);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  return { time: Float64Array.from(times), rate: Float64Array.from(times.map((t) => byTime.get(t))) };
}

// ---------------------------------------------------------------------------
// Dataset job
// ---------------------------------------------------------------------------

function validateJob(job) {
  const ex = exchangeById(job.exchange);
  const market = resolveMarket(ex.id, job.market);
  if (!(job.candle in INTERVAL_MIN)) throw new Error("Unsupported candle interval");
  assertVenueInterval(ex, job.candle);
  if (!["up", "down"].includes(job.direction)) throw new Error("Choose exactly one class direction");
  if (!Number.isInteger(job.basePeriod) || job.basePeriod < 1 || job.basePeriod > 200) throw new Error("EMA baseline must be an integer from 1 to 200");
  if (!finite(job.movePct) || job.movePct <= 0) throw new Error("Move must be greater than zero");
  if (job.direction === "down" && job.movePct >= 100) throw new Error("A downward target must be less than 100%");
  if (!finite(job.retracePct) || job.retracePct < 0 || job.retracePct >= 100) throw new Error("No-retrace must be in [0, 100)");
  if (!Number.isInteger(job.horizonBars) || job.horizonBars < 1) throw new Error("Horizon must be at least one candle");
  if (!finite(job.startMs) || !finite(job.endMs) || job.endMs <= job.startMs) throw new Error("End date must be after start date");
  const features = Array.isArray(job.features) ? job.features.map(String) : [];
  const unknown = features.filter((x) => !ALL_FEATURES.includes(x) || FORBIDDEN.has(x));
  if (unknown.length) throw new Error(`Unknown or forbidden feature: ${unknown[0]}`);
  if (new Set(features).size !== features.length) throw new Error("Duplicate feature names are not allowed");
  const unavailable = features.filter((x) => !featureAvailable(x, ex.id));
  if (unavailable.length) throw new Error(`${ex.name} does not publish ${featureRequirement(unavailable[0])} (${unavailable[0]})`);
  if (!features.length) throw new Error("Select at least one feature");
  return { ...job, exchange: ex.id, market, features };
}

function deriveDataRequirements(job, endMs) {
  const minutes = INTERVAL_MIN[job.candle];
  const scriptWarmup = Math.max(pyRoundPositive(528 * 60 / minutes) + 50, 250);
  const warmupBars = Math.max(scriptWarmup, job.basePeriod * 5);
  const fetchStart = Math.max(0, job.startMs - warmupBars * minutes * 60_000);
  const hasLegacySpecific = job.features.some((name) => FULL_SET.has(name) && !OPTIMAL_SET.has(name));
  const hasOptimalSpecific = job.features.some((name) => OPTIMAL_SET.has(name) && !FULL_SET.has(name));
  const buildLegacy = hasLegacySpecific || (!hasOptimalSpecific && job.preset !== "optimal");
  const buildOptimal = hasOptimalSpecific || (!hasLegacySpecific && job.preset === "optimal");
  const needsBtc = job.features.some((name) => featureGroup(name) === "BTC context");
  return { minutes, warmupBars, fetchStart, endMs, buildLegacy, buildOptimal, needsBtc };
}

function requiredSeries(job, endMs) {
  const req = deriveDataRequirements(job, endMs), list = [], seen = new Set();
  const add = (symbol, interval, role) => {
    const key = `${symbol}:${interval}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ symbol, interval, role, cacheInterval: nativeInterval(job.exchange, interval) });
  };
  add(job.market.symbol, job.candle, "native");
  if (req.minutes > 60 && (req.buildOptimal || req.needsBtc)) add(job.market.symbol, "1h", "context");
  if (req.needsBtc && job.market.symbol !== job.market.btcSymbol) add(job.market.btcSymbol, req.minutes <= 60 ? job.candle : "1h", "btc");
  return { ...req, series: list };
}

async function planCandleCache(rawJob) {
  const job = validateJob(rawJob), ex = EXCHANGES[job.exchange], enabled = job.cacheCandles !== false;
  const endMs = Math.min(job.endMs, Date.now() - ex.settleMs);
  if (endMs <= job.startMs) throw new Error("The selected range has no completed candles yet");
  const required = requiredSeries(job, endMs);
  let requiredRows = 0, missingRows = 0, requests = 0;
  for (const item of required.series) {
    const stepMs = INTERVAL_MIN[item.cacheInterval] * 60_000;
    const startMs = Math.ceil(required.fetchStart / stepMs) * stepMs, rangeEnd = completedRangeEnd(endMs, stepMs);
    const theoretical = Math.max(0, (rangeEnd - startMs) / stepMs);
    let times = [];
    if (enabled && rangeEnd > startMs) {
      try { times = await readCachedTimes(seriesKey(ex, item.symbol, item.cacheInterval), startMs, rangeEnd); } catch {}
    }
    const missing = enabled ? missingCandleRanges(times, startMs, rangeEnd, stepMs) : (theoretical ? [[startMs, rangeEnd]] : []);
    const absent = missing.reduce((sum, [a, b]) => sum + (b - a) / stepMs, 0);
    requiredRows += theoretical; missingRows += absent;
    requests += missing.reduce((sum, [a, b]) => sum + Math.ceil((b - a) / stepMs / ex.pageRows), 0);
  }
  if (enabled) await openCandleDb();
  return {
    enabled, backend: enabled ? candleDbMode : "network", requiredRows, cachedRows: requiredRows - missingRows, missingRows, requests,
    warmupBars: required.warmupBars, fetchStart: required.fetchStart, series: required.series.length,
    exportRowsEstimate: Math.max(0, Math.floor((endMs - job.startMs) / (INTERVAL_MIN[job.candle] * 60_000)) - job.horizonBars),
  };
}

async function runJob(rawJob) {
  const job = validateJob(rawJob), ex = EXCHANGES[job.exchange], market = job.market;
  cancelled = false; activeController = new AbortController();
  const signal = activeController.signal;
  progress(.01, "prepare", `Checking ${ex.short} server time`);
  const now = await serverTime(ex, signal), endMs = Math.min(job.endMs, now - ex.settleMs);
  if (endMs <= job.startMs) throw new Error("The selected range has no completed candles yet");
  const req = requiredSeries(job, endMs);
  const { minutes, warmupBars, fetchStart, buildLegacy, buildOptimal, needsBtc } = req;
  const featureFamily = buildLegacy && buildOptimal ? "mixed" : buildOptimal ? "optimal" : "legacy";
  const cacheEnabled = job.cacheCandles !== false;
  if (cacheEnabled) candleCacheWriteFailed = false;
  const estimatedRows = Math.ceil((endMs - fetchStart) / (minutes * 60_000));
  const cells = estimatedRows * job.features.length, workingWidth = (buildLegacy ? 120 : 0) + (buildOptimal ? 55 : 0);
  if (cells > 55_000_000) throw new Error(`This dataset would allocate about ${(cells * 8 / 1024 / 1024).toFixed(0)} MiB of feature cells. Shorten the range or choose fewer features.`);
  if (estimatedRows * workingWidth > 70_000_000) throw new Error("This range exceeds the browser memory guard. Shorten the range or use a larger candle.");
  if (estimatedRows * job.horizonBars > 450_000_000) throw new Error("This range and horizon exceed the label-scan limit. Shorten one of them.");
  const pageEstimate = req.series.reduce((sum, item) => sum + Math.ceil((endMs - fetchStart) / (INTERVAL_MIN[item.cacheInterval] * 60_000) / ex.pageRows), 0);
  if (!cacheEnabled && pageEstimate > ex.maxPages) throw new Error(`This build needs about ${pageEstimate.toLocaleString()} ${ex.short} requests. Shorten the range or use a larger candle.`);
  post("log", { level: "info", message: `${ex.name} · ${market.symbol} · ${job.candle} · ${new Date(fetchStart).toISOString().slice(0, 16)} → ${new Date(endMs).toISOString().slice(0, 16)} UTC` });

  const reports = [];
  const remember = (candles) => { const r = candles?._report; if (r && !reports.some((x) => x.series === r.series && x.interval === r.interval)) reports.push(r); return candles; };
  const native = remember(await loadCandles(ex, market.symbol, job.candle, fetchStart, endMs, signal, `${market.symbol} ${job.candle}`, [.03, .18], cacheEnabled));
  const contextInterval = minutes <= 60 ? job.candle : "1h";
  let context = minutes <= 60 ? native : null, btc = null;
  if (!context && (buildOptimal || needsBtc)) context = remember(await loadCandles(ex, market.symbol, "1h", fetchStart, endMs, signal, `${market.symbol} 1h context`, [.18, .26], cacheEnabled));
  if (needsBtc) {
    if (market.symbol === market.btcSymbol) btc = minutes <= 60 ? native : context;
    else btc = remember(await loadCandles(ex, market.btcSymbol, contextInterval, fetchStart, endMs, signal, `${market.btcSymbol} ${contextInterval} context`, [.26, .34], cacheEnabled));
  }
  let funding = null;
  if (job.features.some((x) => FUNDING_SET.has(x))) {
    funding = await fetchFunding(ex, market.symbol, Math.max(0, fetchStart - 72 * HOUR_MS), endMs, signal, [.34, .37]);
    if (!funding.time.length) throw new Error("No funding history for this market. Deselect funding features.");
  }
  const cache = {
    enabled: cacheEnabled, backend: cacheEnabled ? candleDbMode : "network", persistent: cacheEnabled && candleDbMode === "indexeddb",
    reusedRows: reports.reduce((s, r) => s + (r.reusedRows || 0), 0), fetchedRows: reports.reduce((s, r) => s + (r.fetchedRows || 0), 0),
    requests: reports.reduce((s, r) => s + (r.requests || 0), 0), synthetic: reports.reduce((s, r) => s + (r.synthetic || 0), 0),
    repaired: reports.reduce((s, r) => s + (r.repaired || 0), 0), maxGapMinutes: reports.reduce((s, r) => Math.max(s, r.maxGapMinutes || 0), 0), series: reports,
  };
  if (cache.synthetic) post("log", { level: "info", message: `${cache.synthetic.toLocaleString()} no-trade candles filled with the previous close.` });
  progress(.38, "features", `Computing ${job.features.length} features`);
  const store = new FeatureStore(job.features);
  if (buildLegacy) await buildLegacyFeatures(native, job.candle, context, btc, funding, store);
  if (buildOptimal) await buildOptimalFeatures(native, job.candle, context, btc, funding, store);
  progress(.70, "label", "Labelling triple-barrier outcomes");
  const labels = await tripleBarrier(native, job);
  const output = await assembleCsv(native, store, { ...job, featureFamily }, labels);
  progress(1, "done", `${output.stats.rows.toLocaleString()} rows ready`);
  const describe = (role, symbol, interval, data) => ({ role, symbol, interval, rows: Number(data?.time?.length) || 0, firstOpenMs: data?.time?.length ? Number(data.time[0]) : null, lastOpenMs: data?.time?.length ? Number(data.time[data.time.length - 1]) : null, synthetic: data?._report?.synthetic || 0, nativeInterval: data?._report?.nativeInterval || interval });
  const sources = [describe("native", market.symbol, job.candle, native)];
  if (context && context !== native) sources.push(describe("context", market.symbol, contextInterval, context));
  if (btc && btc !== native && btc !== context) sources.push(describe("btc", market.btcSymbol, contextInterval, btc));
  return {
    ...output, warmupBars, effectiveEndExclusiveMs: endMs, serverTimeMs: now, sources, cache,
    fundingSource: funding?.time?.length ? { symbol: market.symbol, events: funding.time.length, firstTimeMs: Number(funding.time[0]), lastTimeMs: Number(funding.time[funding.time.length - 1]) } : null,
  };
}

// ---------------------------------------------------------------------------
// Inference replay: rebuild one feature vector exactly as the dataset did.
// ---------------------------------------------------------------------------

function inferFeatureFamily(features, requested) {
  const hasLegacySpecific = features.some((name) => FULL_SET.has(name) && !OPTIMAL_SET.has(name));
  const hasOptimalSpecific = features.some((name) => OPTIMAL_SET.has(name) && !FULL_SET.has(name));
  const inferred = hasLegacySpecific && hasOptimalSpecific ? "mixed" : hasOptimalSpecific ? "optimal" : hasLegacySpecific ? "legacy" : null;
  const family = requested && requested !== "auto" ? requested : inferred;
  if (!family || !["legacy", "optimal", "mixed"].includes(family)) throw new Error("These feature names are shared by both engines. The model profile must name its feature engine.");
  if (family === "legacy" && hasOptimalSpecific) throw new Error("The model uses optimal-engine features but its profile selects the legacy engine");
  if (family === "optimal" && hasLegacySpecific) throw new Error("The model uses legacy-engine features but its profile selects the optimal engine");
  return { family, buildLegacy: family === "legacy" || family === "mixed", buildOptimal: family === "optimal" || family === "mixed" };
}

function validateInferJob(raw) {
  const ex = exchangeById(raw.exchange);
  assertVenueInterval(ex, raw.candle);
  const market = resolveMarket(ex.id, raw.market);
  if (raw.btcSymbol) market.btcSymbol = String(raw.btcSymbol).toUpperCase();
  if (!(raw.candle in INTERVAL_MIN)) throw new Error("Unsupported candle interval");
  if (!Array.isArray(raw.features) || !raw.features.length) throw new Error("The model has no ordered feature names");
  const features = raw.features.map(String);
  const unknown = features.filter((name) => !ALL_FEATURES.includes(name) || FORBIDDEN.has(name));
  if (unknown.length) throw new Error(`The model uses a feature the market engine cannot build: ${unknown[0]}`);
  if (new Set(features).size !== features.length) throw new Error("The model lists a duplicate feature name");
  const unavailable = features.filter((name) => !featureAvailable(name, ex.id));
  if (unavailable.length) throw new Error(`${ex.name} does not publish ${featureRequirement(unavailable[0])}, required by ${unavailable[0]}`);
  const scaleQ = Number(raw.scaleQ);
  if (!Number.isSafeInteger(scaleQ) || scaleQ < 1 || scaleQ > 0xffffffff) throw new Error("Model scaleQ must be a positive uint32");
  const asOfMs = raw.mode === "latest" ? null : Number(raw.asOfMs);
  if (asOfMs !== null && !finite(asOfMs)) throw new Error("Historical time is invalid");
  const basePeriod = Number(raw.basePeriod || 0);
  if (basePeriod && (!Number.isInteger(basePeriod) || basePeriod < 1 || basePeriod > 200)) throw new Error("EMA baseline must be an integer from 1 to 200");
  return { ...raw, exchange: ex.id, market, features, scaleQ, asOfMs, basePeriod, ...inferFeatureFamily(features, raw.featureFamily || "auto") };
}

async function runInference(rawJob) {
  const job = validateInferJob(rawJob), ex = EXCHANGES[job.exchange], market = job.market;
  cancelled = false; activeController = new AbortController();
  const signal = activeController.signal;
  progress(.01, "prepare", `Freezing ${ex.short} server time`);
  const now = await serverTime(ex, signal);
  const settledNow = now - ex.settleMs;
  const cutoff = job.asOfMs === null ? settledNow : Math.min(job.asOfMs, settledNow);
  const candleMs = INTERVAL_MIN[job.candle] * 60_000;
  const selectedOpen = Math.floor((cutoff - candleMs) / candleMs) * candleMs;
  const signalAvailableMs = selectedOpen + candleMs;
  if (!finite(selectedOpen) || selectedOpen < 0 || signalAvailableMs > settledNow) throw new Error("No completed candle exists before the selected time");

  const defaultWarmup = Math.max(pyRoundPositive(528 * 60 / INTERVAL_MIN[job.candle]) + 50, 250, job.basePeriod ? job.basePeriod * 5 : 0);
  const warmupBars = Number.isInteger(job.warmupBars) && job.warmupBars >= defaultWarmup ? job.warmupBars : defaultWarmup;
  const fallbackStart = Math.max(0, selectedOpen - warmupBars * candleMs);
  const hasSeed = job.featureSeedStartMs !== null && job.featureSeedStartMs !== undefined && job.featureSeedStartMs !== "";
  const seedStart = hasSeed ? Number(job.featureSeedStartMs) : NaN;
  if (hasSeed && (!finite(seedStart) || seedStart < 0 || seedStart % candleMs !== 0)) throw new Error("The model's feature seed is not a candle boundary");
  if (hasSeed && seedStart > fallbackStart) throw new Error("The selected time is earlier than the model's safe warm-up window. Choose a later time.");
  // Replay window. Inputs must equal those a replay from the model's training seed gives. Every market signal's memory
  // fades: against a 400-day replay from the seed, inputs are bit-identical with 90 days of history (all 212 signals at
  // scale 1,000,000; the slowest is a 200-hour moving average), and signals counted in candles fade within 4,000
  // candles. So the replay starts at the seed or REPLAY before the candle, whichever is later (120 days, a third more
  // than measured, or 4,000 candles), instead of always at the seed: an old model no longer replays its whole life.
  const REPLAY_MS = Math.max(120 * 24 * HOUR_MS, 4000 * candleMs);
  const boundedStart = Math.floor((selectedOpen - REPLAY_MS) / candleMs) * candleMs;
  let fetchStart = hasSeed ? Math.min(Math.max(seedStart, boundedStart), fallbackStart) : fallbackStart;
  // Hyperliquid keeps only its latest candles: start no earlier than they reach (at most a few millionths off on the
  // slowest signal) instead of failing once a model is older than that history.
  let historyCapped = false;
  if (ex.historyRows) {
    const earliest = Math.floor(now / candleMs) * candleMs - (ex.historyRows - 3) * candleMs;
    if (fetchStart < earliest && earliest <= fallbackStart) { fetchStart = earliest; historyCapped = true; }
  }
  const estimatedRows = Math.ceil((signalAvailableMs - fetchStart) / candleMs);
  const workingWidth = (job.buildLegacy ? 120 : 0) + (job.buildOptimal ? 55 : 0);
  if (!Number.isSafeInteger(estimatedRows) || estimatedRows < 1) throw new Error("The requested history has an invalid size");
  if (estimatedRows * job.features.length > 55_000_000 || estimatedRows * workingWidth > 70_000_000) throw new Error("This replay exceeds the browser memory guard. Use a coarser candle model.");
  post("log", { level: "info", message: `Candle ${new Date(selectedOpen).toISOString().slice(0, 16)} UTC · closes ${new Date(signalAvailableMs).toISOString().slice(0, 16)} UTC` });

  const cacheEnabled = job.cacheCandles !== false;
  const native = await loadCandles(ex, market.symbol, job.candle, fetchStart, signalAvailableMs, signal, `${market.symbol} ${job.candle}`, [.03, .3], cacheEnabled);
  if (native.time[native.time.length - 1] !== selectedOpen) throw new Error(`${ex.short} did not return the completed candle at ${new Date(selectedOpen).toISOString()}`);
  const minutes = INTERVAL_MIN[job.candle], needsBtc = job.features.some((name) => featureGroup(name) === "BTC context"), contextInterval = minutes <= 60 ? job.candle : "1h";
  let context = minutes <= 60 ? native : null, btc = null;
  if (!context && (job.buildOptimal || needsBtc)) context = await loadCandles(ex, market.symbol, "1h", fetchStart, signalAvailableMs, signal, `${market.symbol} 1h context`, [.3, .4], cacheEnabled);
  if (needsBtc) btc = market.symbol === market.btcSymbol ? (minutes <= 60 ? native : context) : await loadCandles(ex, market.btcSymbol, contextInterval, fetchStart, signalAvailableMs, signal, `${market.btcSymbol} ${contextInterval} context`, [.4, .5], cacheEnabled);
  let funding = null;
  if (job.features.some((name) => FUNDING_SET.has(name))) {
    funding = await fetchFunding(ex, market.symbol, Math.max(0, fetchStart - 72 * HOUR_MS), signalAvailableMs, signal, [.5, .55]);
    if (!funding.time.length) throw new Error("No funding history for this market and time");
  }

  progress(.6, "features", `Replaying ${job.features.length} features`);
  const store = new FeatureStore(job.features);
  if (job.buildLegacy) await buildLegacyFeatures(native, job.candle, context, btc, funding, store);
  if (job.buildOptimal) await buildOptimalFeatures(native, job.candle, context, btc, funding, store);
  const missing = job.features.filter((name) => !store.columns.has(name));
  if (missing.length) throw new Error(`The market engine did not build ${missing[0]}`);

  const row = native.time.length - 1, values = [], valuesF32 = [], valuesQ = [], saturated = [];
  for (const name of job.features) {
    const value = store.columns.get(name)[row];
    if (!finite(value)) throw new Error(`${name} is not finite at this candle; the warm-up window is too short`);
    // GL1F quantizer (manuscript eq. quantizer): Q(z) = clamp_int32(floor(Q*z + 1/2)) on the binary32 value.
    const f32 = Math.fround(value);
    if (!finite(f32)) throw new Error(`${name} is outside the binary32 range at this candle`);
    const rounded = Math.round(f32 * job.scaleQ), q = Math.max(-2147483648, Math.min(2147483647, rounded));
    if (q !== rounded) saturated.push(name);
    values.push(value); valuesF32.push(f32); valuesQ.push(q);
  }
  const baseline = job.basePeriod ? ema(native.close, job.basePeriod)[row] : NaN;
  progress(1, "ready", "Feature vector ready");
  return {
    exchange: ex.id, venue: ex.venue, exchangeName: ex.name, symbol: market.symbol, candle: job.candle, featureFamily: job.family,
    featureVersion: job.family === "legacy" ? "btc-context-v2" : job.family === "optimal" ? "optimal-context-v3" : "btc-context-v2 + optimal-context-v3",
    features: job.features, values, valuesF32, valuesQ, saturated, scaleQ: job.scaleQ,
    tailColumns: [...store.tailColumns].filter((name) => job.features.includes(name)),
    selectedOpenMs: selectedOpen, signalAvailableMs, asOfMs: cutoff, serverTimeMs: now,
    fetchStartMs: fetchStart, warmupBars, warmupSource: historyCapped ? "the exchange's available history" : hasSeed ? (fetchStart > seedStart ? "converged window from the profile seed" : "profile seed") : "minimum warm-up",
    candleData: { open: native.open[row], high: native.high[row], low: native.low[row], close: native.close[row], volume: native.volume[row], synthetic: native.synthetic[row] === 1 },
    baseline: finite(baseline) ? baseline : null,
  };
}


// ---------------------------------------------------------------------------
// Backtest replay: feature rows for every completed candle in a range
// ---------------------------------------------------------------------------

async function runBacktest(rawJob) {
  const candle = rawJob?.candle;
  if (!(candle in INTERVAL_MIN)) throw new Error("Unsupported candle interval");
  const candleMs = INTERVAL_MIN[candle] * 60_000;
  const job = validateInferJob({ ...rawJob, mode: "historical", asOfMs: Number(rawJob.endMs) });
  const ex = EXCHANGES[job.exchange], market = job.market;
  cancelled = false; activeController = new AbortController();
  const signal = activeController.signal;
  progress(.01, "prepare", `Freezing ${ex.short} server time`);
  const now = await serverTime(ex, signal);
  const endMs = Math.floor(Math.min(Number(rawJob.endMs), now - ex.settleMs) / candleMs) * candleMs;
  let startMs = Math.ceil(Number(rawJob.startMs) / candleMs) * candleMs;
  if (!finite(startMs) || !finite(endMs) || endMs - startMs < 2 * candleMs) throw new Error("The backtest range needs at least two completed candles");
  const defaultWarmup = Math.max(pyRoundPositive(528 * 60 / INTERVAL_MIN[candle]) + 50, 250, job.basePeriod ? job.basePeriod * 5 : 0);
  const warmupBars = Number.isInteger(job.warmupBars) && job.warmupBars >= defaultWarmup ? job.warmupBars : defaultWarmup;
  const hasSeed = job.featureSeedStartMs !== null && job.featureSeedStartMs !== undefined && job.featureSeedStartMs !== "";
  const seed = hasSeed ? Number(job.featureSeedStartMs) : NaN;
  if (hasSeed && (!finite(seed) || seed < 0 || seed % candleMs !== 0)) throw new Error("The model's feature seed is not a candle boundary");
  let moved = false;
  if (hasSeed && seed + warmupBars * candleMs > startMs) { startMs = seed + warmupBars * candleMs; moved = true; }
  if (endMs - startMs < 2 * candleMs) throw new Error("The range ends before the model's features are warmed up. Choose a later range.");
  const fetchStart = hasSeed ? seed : Math.max(0, startMs - warmupBars * candleMs);
  const totalRows = Math.ceil((endMs - fetchStart) / candleMs), rangeRows = Math.ceil((endMs - startMs) / candleMs);
  const workingWidth = (job.buildLegacy ? 120 : 0) + (job.buildOptimal ? 55 : 0);
  if (rangeRows > 200_000 || totalRows * job.features.length > 55_000_000 || totalRows * workingWidth > 70_000_000) throw new Error("This range is too large for the browser. Shorten it or use a larger candle.");
  if (moved) post("log", { level: "warn", message: `Start moved to ${new Date(startMs).toISOString().slice(0, 16)} UTC, the first candle with fully warmed features.` });
  const cacheEnabled = job.cacheCandles !== false;
  const native = await loadCandles(ex, market.symbol, candle, fetchStart, endMs, signal, `${market.symbol} ${candle}`, [.03, .45], cacheEnabled);
  const minutes = INTERVAL_MIN[candle], needsBtc = job.features.some((name) => featureGroup(name) === "BTC context"), contextInterval = minutes <= 60 ? candle : "1h";
  let context = minutes <= 60 ? native : null, btc = null;
  if (!context && (job.buildOptimal || needsBtc)) context = await loadCandles(ex, market.symbol, "1h", fetchStart, endMs, signal, `${market.symbol} 1h context`, [.45, .55], cacheEnabled);
  if (needsBtc) btc = market.symbol === market.btcSymbol ? (minutes <= 60 ? native : context) : await loadCandles(ex, market.btcSymbol, contextInterval, fetchStart, endMs, signal, `${market.btcSymbol} ${contextInterval} context`, [.55, .65], cacheEnabled);
  let funding = null;
  if (job.features.some((name) => FUNDING_SET.has(name))) {
    funding = await fetchFunding(ex, market.symbol, Math.max(0, fetchStart - 72 * HOUR_MS), endMs, signal, [.65, .7]);
    if (!funding.time.length) throw new Error("No funding history for this market and range");
  }
  progress(.72, "features", `Replaying ${job.features.length} features on ${rangeRows.toLocaleString()} candles`);
  const store = new FeatureStore(job.features);
  if (job.buildLegacy) await buildLegacyFeatures(native, candle, context, btc, funding, store);
  if (job.buildOptimal) await buildOptimalFeatures(native, candle, context, btc, funding, store);
  const missingCol = job.features.find((name) => !store.columns.has(name));
  if (missingCol) throw new Error(`The market engine did not build ${missingCol}`);
  let first = 0;
  while (first < native.time.length && native.time[first] < startMs) first++;
  const n = native.time.length - first, F = job.features.length;
  if (n < 2) throw new Error("No completed candles in this range");
  const X = new Float32Array(n * F), valid = new Uint8Array(n), cols = job.features.map((name) => store.columns.get(name));
  let skipped = 0;
  for (let r = 0; r < n; r++) {
    let ok = 1;
    for (let j = 0; j < F; j++) {
      const f32 = Math.fround(cols[j][first + r]);
      if (!finite(f32)) { ok = 0; break; }
      X[r * F + j] = f32;
    }
    valid[r] = ok;
    if (!ok) skipped++;
  }
  const slice = (arr) => Float64Array.from(arr.subarray(first));
  // Optional labels by the dataset's own rule, over the same candles from the same start: verifiable training reports.
  const y = rawJob.label ? Int8Array.from((await tripleBarrier(native, rawJob.label)).subarray(first)) : null;
  const baseline = job.basePeriod ? Float64Array.from(ema(native.close, job.basePeriod).subarray(first)) : new Float64Array(n).fill(NaN);
  progress(1, "ready", `${n.toLocaleString()} candles ready`);
  return {
    exchange: ex.id, venue: ex.venue, exchangeName: ex.name, symbol: market.symbol, candle, nRows: n, nFeatures: F, features: job.features,
    startMs: native.time[first], endMs, fetchStartMs: fetchStart, serverTimeMs: now, warmupSource: hasSeed ? "profile seed" : "minimum warm-up",
    times: slice(native.time), open: slice(native.open), high: slice(native.high), low: slice(native.low), close: slice(native.close),
    baseline, synthetic: Uint8Array.from(native.synthetic.subarray(first)), X, valid, y, skipped, startMoved: moved,
  };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

if (typeof self !== "undefined" && self.addEventListener && typeof module === "undefined") {
  self.addEventListener("message", async (event) => {
    const message = event.data || {};
    const reply = (type, detail = {}, transfer = []) => post(type, { requestId: message.requestId, ...detail }, transfer);
    if (message.type === "env") { WORLD_ENV = { ...WORLD_ENV, ...message }; return; }
    if (message.type === "cancel") { cancelled = true; activeController?.abort(); return; }
    if (message.type === "catalogue") {
      reply("catalogue", { exchange: message.exchange || "binance", features: worldAvailability(catalogue(message.exchange || "binance")), presets: { small: SMALL_FEATURES, optimal: OPTIMAL_FEATURES, full: FULL_FEATURES, exotic: [...SMALL_FEATURES, ...WORLD_FEATURES.filter((x) => WORLD_META[x].group === "Astronomy")], all: ALL_FEATURES }, intervals: Object.keys(INTERVAL_MIN), scaleQ: Q });
      return;
    }
    if (message.type === "markets") {
      try { reply("markets", await fetchMarkets(message.exchange)); }
      catch (error) { reply("marketsError", { exchange: message.exchange, message: error?.message || String(error) }); }
      return;
    }
    if (message.type === "cachePlan") {
      try { reply("cachePlan", { plan: await planCandleCache(message.job) }); }
      catch (error) { reply("cachePlanError", { message: error?.message || String(error) }); }
      return;
    }
    if (message.type === "cacheInspect" || message.type === "cacheClear") {
      try {
        if (message.type === "cacheClear") {
          if (jobRunning) throw new Error("Wait for the running job to finish");
          await clearCandleCache();
        }
        reply("cacheInfo", { cache: await inspectCandleCache() });
      } catch (error) { reply("cacheError", { message: error?.message || String(error) }); }
      return;
    }
    if (message.type === "build" || message.type === "infer" || message.type === "backtest") {
      if (jobRunning) { reply("error", { message: "Another market job is running" }); return; }
      jobRunning = true;
      try {
        if (message.type === "build") {
          const result = await runJob(message.job);
          const m = result.matrix;
          reply("done", result, [m.X.buffer, m.y.buffer, m.times.buffer, m.close.buffer]);
        } else if (message.type === "backtest") {
          const r = await runBacktest(message.job);
          reply("backtest", r, [r.times.buffer, r.open.buffer, r.high.buffer, r.low.buffer, r.close.buffer, r.baseline.buffer, r.synthetic.buffer, r.X.buffer, r.valid.buffer, ...(r.y ? [r.y.buffer] : [])]);
        } else {
          reply("vector", await runInference(message.job));
        }
      } catch (error) {
        if (error?.name === "AbortError" || cancelled) reply("cancelled");
        else reply("error", { message: error?.message || String(error) });
      } finally {
        activeController = null; cancelled = false; jobRunning = false;
      }
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    INTERVAL_MIN, EXCHANGES, FULL_FEATURES, SMALL_FEATURES, OPTIMAL_FEATURES, ALL_FEATURES,
    featureAvailable, featureRequirement, featureGroup, catalogue, resolveMarket, nativeInterval, validateJob, validateInferJob,
    parseBinanceRows, parseCoinbaseRows, aggregateCandles, fillCoinbaseRows, missingCandleRanges,
    loadCandles, loadNativeSeries, runJob, runInference, runBacktest, planCandleCache, fetchMarkets, MAX_FILLED_GAP_MINUTES, parseHyperliquidRows, EXCHANGE_PROVIDES,
    tailTransform, tripleBarrier, buildLegacyFeatures, buildOptimalFeatures, FeatureStore, ema, featureNote, WORLD_FEATURES,
    setCancelled(value) { cancelled = !!value; },
  };
}
