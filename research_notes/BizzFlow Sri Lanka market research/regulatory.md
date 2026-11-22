# Sri Lanka Regulatory & Compliance Requirements for a Business-Management SaaS (as of Nov 2026)

## VAT, SSCL, invoice format, e-invoicing / RAMIS

### Takeaway
2026 is a big compliance year. VAT stays at 18%. A revised mandatory tax-invoice format applies from 1 Oct 2026. The IRD is rolling out real-time e-invoicing over a RAMIS Web API in phases. The VAT Amendment Act No. 14 of 2026 legally requires CGIR-approved "secured POS machines" with real-time data capture, but the start date and specifications are not yet prescribed. That gap is the single largest demand driver for POS and invoicing software.

### Cited Findings
- Standard VAT rate is 18% (since 1 Jan 2024). VAT on financial services rises to 20.5% from 1 Jul 2026. — [Trykintsugi](https://trykintsugi.com/sales-tax-guides/apac/sri-lanka); [KPMG TNF Jul 2026](https://kpmg.com/us/en/taxnewsflash/news/2026/07/tnf-sri-lanka-amendments-to-vat-act.html)
- Registration threshold is LKR 60m in any 12 months or LKR 15m in any quarter. — [Trykintsugi](https://trykintsugi.com/sales-tax-guides/apac/sri-lanka)
- **Conflict on the threshold:** Budget 2026 and the May 2026 Bill proposed cutting the VAT/SSCL threshold to LKR 36m from 1 Apr 2026 ([Daily FT](https://www.ft.lk/business/Govt-widens-VAT-net-new-Bill-cuts-threshold-taxes-digital-services-raises-financial-sector-levy/34-791395); [KPMG Budget 2026](https://kpmg.com/us/en/taxnewsflash/news/2025/11/sri-lanka-budget-2026-tax-proposals.html)). Comarch reports the government dropped the cut after objections ([Comarch](https://comarch.com/trade-and-services/data-management/legal-regulation-changes/sri-lanka-postpones-revised-vat-invoice-format-amid-wider-vat-reforms)). KPMG's summary of the enacted Act says registration thresholds are "continued" ([KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/07/tnf-sri-lanka-amendments-to-vat-act.html)). The most likely reading is that LKR 60m still stands, but verify on ird.gov.lk.
- VAT (Amendment) Act No. 14 of 2026 was certified on 30 Jun 2026 and gazetted on 3 Jul 2026. It brings in: VAT on non-resident digital/electronic-platform services from 1 Jul 2026 (B2B supplies to VAT-registered persons excluded, s.25N); submission of VAT schedules; use of secured POS machines; higher penalties; criminal proceedings; and publication of information on registered persons. — [KPMG TNF](https://kpmg.com/us/en/taxnewsflash/news/2026/07/tnf-sri-lanka-value-added-tax-amendment-act-no-14-of-2026-introduces-vat-on-nonresident-digital-service-providers.html); [KPMG Jul 2026](https://kpmg.com/us/en/taxnewsflash/news/2026/07/tnf-sri-lanka-amendments-to-vat-act.html)
- New s.64B requires registered persons to use CGIR-approved secured POS machines that capture transaction data in real time, within 3 months of a date to be set by regulation. Specifications are to be prescribed by the CGIR. — [De Saram](https://www.desaram.com/sri-lanka-vat-changes-2026-key-updates-businesses-must-know/); [LBO](https://www.lankabusinessonline.com/2026/05/04/sri-lankas-new-vat-amendment-to-digitize-tax-collection-via-secured-pos-systems/)
- **POS timing conflict:** one Daily FT piece expects Phase III (POS for all VAT-registered entities) to start by end-2026 ([Daily FT](https://www.ft.lk/front-page/IRD-expands-digital-invoicing-rollout-as-second-phase-gets-underway/44-793040)). Another (Aug 2026) reports unresolved roadblocks and says full implementation is about two years away ([Daily FT](https://www.ft.lk/top-story/IRD-facing-roadblocks-in-digital-POS-rollout/26-796303)).
- There were 36,656 registered VAT taxpayers as at 30 Jun 2026. — [via search summary of IRD data / Daily FT](https://www.ft.lk/top-story/IRD-facing-roadblocks-in-digital-POS-rollout/26-796303)
- E-invoicing phases:
  - Phase I started Oct 2025, voluntary, with 340+ companies (exporters, tea).
  - Phase II started around Jun 2026: voluntary for VAT-registered businesses, with technical documentation sent to 27 exporters and 170 manufacturers, and retail chains in talks.
  - ERP and other systems connect to RAMIS through a web API for real-time exchange.
  - Source: [Daily FT](https://www.ft.lk/front-page/IRD-expands-digital-invoicing-rollout-as-second-phase-gets-underway/44-793040)
- Full integration is targeted for end-2026, and B2C comes in a later phase. — [VATupdate](https://www.vatupdate.com/2026/05/09/sri-lanka-launches-national-e-invoicing-system-for-vat-under-2026-budget-full-rollout-by-year-end/) (search snippet only; fetch blocked)
- Revised tax-invoice format: originally Gazette 2463/05, revised by Gazette 2481/22 (27 Mar 2026), then postponed from 1 Jul to **1 Oct 2026** by Gazette 2500/106 (6 Aug 2026). It applies to all VAT-registered persons. Its requirements are:
  - 9-digit supplier and purchaser TINs
  - invoice number in the structure YYMMM_QQQQ_XXXXX, continuous (may restart annually or monthly)
  - "date of supply" in place of "date of delivery"
  - place of supply only when it differs from the place of issue
  - LKR amounts to 2 decimals
  - total in words optional, phone number optional
  - payment method, which may be the expected method
  - layout can be customised as long as the mandated fields are present
  - Source: [Comarch](https://comarch.com/trade-and-services/data-management/legal-regulation-changes/sri-lanka-postpones-revised-vat-invoice-format-amid-wider-vat-reforms)
- Daily FT commentary questions whether SMEs are ready for the 2026 invoice reform. — [Daily FT](https://www.ft.lk/columns/VAT-Invoice-Reform-2026-A-necessary-step-forward-but-are-SMEs-ready/4-792457)
- SSCL changes in Budget 2026 concern vehicles (SSCL at import or manufacture) and coconut/palm oil imports (moved to VAT + SSCL from Apr 2026). SSCL registration is tied to the same threshold as VAT. — [KPMG Budget](https://kpmg.com/us/en/taxnewsflash/news/2025/11/sri-lanka-budget-2026-tax-proposals.html); [BDO](https://www.bdo.lk/getmedia/8ef8371b-0e56-4699-a65e-255756302de9/BDO-Budget-Highlights-2026.pdf)

### Inferences
- Software needs:
  - the Oct 2026 invoice template and numbering scheme
  - TIN validation
  - VAT schedule exports
  - a RAMIS API connector, in time for Phase III or a mandatory phase
  - readiness for secured-POS certification, once the CGIR publishes specifications
- If BizzFlow becomes an early "CGIR-approved" POS/ERP connector, that is a strong moat. Watch for the regulation that sets the s.64B date.
- BizzFlow, as a SaaS seller, is a resident supplier. It must charge VAT if it crosses the threshold. Foreign competitors now also bear 18% VAT on B2C sales, which narrows their price advantage.

### Gaps
- Official IRD text of the e-invoicing API specification, the vendor accreditation process, and the mandatory dates. Not found.
- The current SSCL rate (2.5% on 50%/100% of turnover by sector, from training knowledge) was not verified in 2026 sources.
- The final threshold figure needs confirmation directly on ird.gov.lk.

## Payroll: EPF, ETF, APIT, gratuity, statutory reports

### Takeaway
Payroll software must compute EPF (8% employee, 12% employer), ETF (3% employer) and the 2025/26 APIT tables (8 tables, tax-free LKR 1.8m per year / LKR 150k per month), and produce the monthly remittances and returns.

### Cited Findings
- EPF: 8% employee and 12% employer. ETF: 3% employer only. Contributions are due by the last working day of the following month. — [Ramco](https://www.ramco.com/payce/payroll-compliance-sri-lanka); [Teamed](https://www.teamed.global/country-hiring-guides/sri-lanka/tax-and-payroll)
- The IRD published 8 APIT tables for YA 2025/26, including Table 8 for residents working remotely for foreign employers. They follow the Inland Revenue (Amendment) Act No. 2 of 2025: tax-free threshold LKR 1.8m per year (LKR 150k per month, up from LKR 100k). — [KPMG APIT flash](https://assets.kpmg.com/content/dam/kpmg/lk/pdf/kpmg-tax-news/2025/march-2025/Tax-Flash-News-APIT-Tables.pdf)
- Reported bands are 0/6/18/24/30/36%, with the 12% band removed. A secondary source conflicts on whether the 12% band remains. — [CountryTaxCalc](https://www.countrytaxcalc.com/tax-guides/sri-lanka-tax-guide/); [NearJobs calculator](https://nearjobs.lk/tools/income-tax-calculator/)
- The proposed amended tax code would bring higher rates, a wider net and tighter compliance (a proposal, not confirmed as enacted). — [Daily FT](https://www.ft.lk/top-story/Amended-tax-code-proposes-higher-rates-wider-net-and-tighter-compliance-regime/26-788861)

### Inferences
- APIT tables are configurable data and change with the Year of Assessment (April to March). Ship them as updatable tables.
- Required outputs likely include:
  - EPF C-form monthly return and ETF return
  - APIT monthly remittance and annual employee declaration
  - payslips
  - gratuity provisioning (an SLFRS liability)

### Gaps
- The Payment of Gratuity Act No. 12 of 1983 (generally half a month's salary per year of service after 5 years, for employers with 15+ workmen) was not verified in 2026 sources. Neither was any gratuity reform.
- Exact current EPF/ETF electronic filing formats (CBSL EPF e-return, ETF Board online) were not researched.

## Personal Data Protection Act No. 9 of 2022

### Takeaway
The PDPA, as amended by Act No. 22 of 2025, has its core compliance provisions (Parts I and III, s.2–3) taking effect on **1 January 2027**. SaaS processors will have contractual, DPO and cross-border obligations from that date.

### Cited Findings
- Extraordinary Gazette 2498/16 (22 Jul 2026) sets 1 Jan 2027 for s.2 (scope), s.3, Part I (lawful processing) and Part III (controllers/processors, contracts, DPO designation, cross-border processing). — [Daily FT, Aug 2026](https://www.ft.lk/front-page/Data-protection-compliance-regime-takes-effect-on-1-Jan-2027/44-795776)
- PDP (Amendment) Act No. 22 of 2025 was passed on 21 Oct 2025 and certified on 30 Oct 2025. — [Ada Derana](https://www.adaderana.lk/news/114164/speaker-endorses-personal-data-protection-amendment-bill); [Act text](https://dpa.gov.lk/acts/22-2025_E_251104_201549.pdf)
- The earlier enforcement start (18 Mar 2025) was superseded. Part IV (unsolicited messages) is deferred. — [DPA](https://dpa.gov.lk/est.php); [Daily Mirror](https://www.dailymirror.lk/breaking-news/Legal-experts-flag-unique-compliance-landscape-in-staggered-PDPA-rollout/108-346685)

### Inferences
- BizzFlow is a processor for its customers' customer and employee data, and a controller for its own account data. It needs:
  - a DPA/processing agreement template
  - a DPO
  - breach notification processes
  - data subject access, erasure and export tools within the product
  - consent capture for marketing (WhatsApp/SMS)
- Cross-border hosting (for example AWS Singapore) needs a review of transfer rules under the amended Act.

### Gaps
- The specific cross-border transfer rules after the 2025 amendment, DPA adequacy lists, breach notification timelines and fines were not extracted. Read the Act PDF.

## Electronic Transactions, e-commerce consumer protection, CBSL payments

### Takeaway
E-signatures and records have legal validity under the ETA (2006, amended 2017). The 2023 CAA directions impose disclosure duties on online sellers. CBSL regulates payment apps and acquirers, and gateways are generally used through licensed acquirers.

### Cited Findings
- Electronic Transactions Act No. 19 of 2006 was amended by Act No. 25 of 2017 to align with the UN Electronic Communications Convention. — [Act 25/2017](https://www.documents.gov.lk/view/acts/2017/11/25-2017_E.pdf); [ICTA](https://www.icta.lk/news/new-e-commerce-laws-major-boost-to-sri-lankan-trade-and-commerce/)
- CAA Gazette 2332/15 (May 2023) applies to e-commerce sellers and platforms. It requires disclosures on seller identity, after-sales service, refunds, warranties, privacy policy and dispute redress. — [Gazette](https://www.documents.gov.lk/view/extra-gazettes/2023/5/2332-15_E.pdf); [De Saram](https://www.desaram.com/new-regulations-for-online-sellers-consumer-affairs-act-gazatte/)
- The e-commerce framework is described as fragmented. — [Daily Mirror](https://www.dailymirror.lk/breaking-news/SL%E2%80%99s-e-commerce-rules-still-playing-catch-up/108-324137)
- CBSL has a Mobile Payment Application Providers circular (PSD Circular 01/2026, effective 2 Feb 2026) that covers third-party apps using a transaction acquirer. Its power to regulate payment systems comes from s.7(e) of the CBSL Act No. 16 of 2023. — [CBSL circular](https://www.cbsl.gov.lk/sites/default/files/cbslweb_documents/laws/cdg/psd_circular_no_01_of_2026_e.pdf); [RegAlert](https://regalert.today/document/12ce75f0-6f5d-4acd-baa1-e48665cca456)

### Inferences
- E-commerce storefront templates should build in the CAA disclosures (returns, warranty, privacy, contact).
- If BizzFlow offers an in-app QR or payment app, check whether the MPAP circular requires registration. Integrating licensed gateways (PayHere, banks' IPGs) keeps BizzFlow outside licensing.

### Gaps
- No 2026 CBSL licence regime specific to payment gateways was found. LankaQR mandates and penalties for non-compliance with the CAA directions were not verified.

## Accounting standards (SLFRS for SMEs) and audit

### Takeaway
CA Sri Lanka issues SLFRS. SLFRS for SMEs is permitted for non-SBE and smaller SBE entities. The Companies (Amendment) Act No. 12 of 2025 adds beneficial ownership disclosures, which became operational on 30 Mar 2026.

### Cited Findings
- Sri Lanka adopted IFRS for SMEs as SLFRS for SMEs. SBEs under the threshold category may use it, and Empower Board listed SMEs may use it for 3 periods. — [IFRS profile](https://www.ifrs.org/content/dam/ifrs/publications/jurisdictions/pdf-profiles/sri-lanka-ifrs-profile.pdf)
- Companies (Amendment) Act No. 12 of 2025 (4 Aug 2025) adds beneficial ownership disclosures (s.130A–J). The BO Regulation No. 1 of 2026 has been operational since 30 Mar 2026. — [Daily FT](https://www.ft.lk/columns/Companies-Amendment-Act-No-12-of-2025-Legal-reforms-and-comparative-insights/4-781222); [Chambers](https://gpg-pdf.chambers.com/Doing-Business-In-2026/1006/)

### Inferences
- Accounting features should support SLFRS for SMEs financial statements, audit trails (immutable, sequential invoice logs, which the VAT format also requires) and fixed-asset and gratuity provisions.

### Gaps
- Small-company audit exemption thresholds under the Companies Act were not found.
- Record retention periods (the IRD's 5 years, from training knowledge) were not verified.
