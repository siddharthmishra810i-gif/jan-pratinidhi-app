import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "./src/database/db";
import { logger } from "./src/utils/logger";

const statesToScrape = [
  { dbName: "Himachal Pradesh", prsName: "Himachal Pradesh" },
  { dbName: "Uttarakhand", prsName: "Uttarakhand" },
  { dbName: "Punjab", prsName: "Punjab" },
  { dbName: "Jammu and Kashmir", prsName: "Jammu and Kashmir" },
  { dbName: "Haryana", prsName: "Haryana" },
  { dbName: "Rajasthan", prsName: "Rajasthan" },
  { dbName: "Uttar Pradesh", prsName: "Uttar Pradesh" },
  { dbName: "Gujarat", prsName: "Gujarat" },
  { dbName: "Sikkim", prsName: "Sikkim" },
  { dbName: "Assam", prsName: "Assam" },
  { dbName: "Arunachal Pradesh", prsName: "Arunachal Pradesh" },
  { dbName: "Nagaland", prsName: "Nagaland" },
  { dbName: "Meghalaya", prsName: "Meghalaya" },
  { dbName: "NCT of Delhi", prsName: "Delhi" },
  { dbName: "Tripura", prsName: "Tripura" },
  { dbName: "Mizoram", prsName: "Mizoram" },
  { dbName: "Manipur", prsName: "Manipur" },
  { dbName: "Bihar", prsName: "Bihar" },
  { dbName: "West Bengal", prsName: "West Bengal" },
  { dbName: "Madhya Pradesh", prsName: "Madhya Pradesh" },
  { dbName: "Chhattisgarh", prsName: "Chhattisgarh" },
  { dbName: "Odisha", prsName: "Odisha" },
  { dbName: "Maharashtra", prsName: "Maharashtra" },
  { dbName: "Telangana", prsName: "Telangana" },
  { dbName: "Goa", prsName: "Goa" },
  { dbName: "Karnataka", prsName: "Karnataka" },
  { dbName: "Andhra Pradesh", prsName: "Andhra Pradesh" },
  { dbName: "Kerala", prsName: "Kerala" }
];

// Helper to parse CSV with potential quotes/commas inside quotes
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(current.trim());
      if (row.length > 0 && row.some(cell => cell !== '')) {
        result.push(row);
      }
      row = [];
      current = '';
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      current += char;
    }
  }

  if (current || row.length > 0) {
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

function normalizeConstituencyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/\(sc\)|\(st\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizeCandidateName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(shri|smt|dr\.|dr|mr\.|mr|mrs\.|mrs|prof\.|prof|adv\.|adv)\s+/g, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

function isNameSimilar(name1: string, name2: string): boolean {
  const n1 = normalizeCandidateName(name1);
  const n2 = normalizeCandidateName(name2);
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const words1 = name1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = name2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const intersection = words1.filter(w => words2.includes(w));
  if (intersection.length > 0) return true;

  return false;
}

function parseAttendance(val: string): number | null {
  if (!val || val.toLowerCase() === "na" || val.toLowerCase() === "n/a") return null;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
}

function parseQuestions(val: string): number | null {
  if (!val || val.toLowerCase() === "na" || val.toLowerCase() === "n/a") return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseAge(val: string): number | null {
  if (!val || val.toLowerCase() === "na" || val.toLowerCase() === "n/a" || val.includes("Info Not Available")) return null;
  const parsed = parseInt(val.replace(/\D/g, ""), 10);
  return isNaN(parsed) ? null : parsed;
}

async function scrapeStatePRS(dbName: string, prsName: string) {
  logger.info(`Starting PRS scrape for ${dbName} (${prsName})...`);

  // Find state in database
  const stateRecord = await prisma.state.findUnique({
    where: { name: dbName }
  });

  if (!stateRecord) {
    logger.warn(`State ${dbName} not found in database. Skipping.`);
    return;
  }

  // Find latest election to associate new by-election candidates with
  const electionRecord = await prisma.election.findFirst({
    where: { stateId: stateRecord.id },
    orderBy: { year: "desc" }
  });

  if (!electionRecord) {
    logger.warn(`No election record found for state ${dbName}. Skipping.`);
    return;
  }

  // Fetch state page
  const pageUrl = `https://prsindia.org/mlatrack?state=${encodeURIComponent(prsName)}`;
  const { data: html } = await axios.get(pageUrl, { timeout: 60000 });
  const $ = cheerio.load(html);

  let csvLink = $("#mptrack-expor-link").attr("href");
  if (!csvLink) {
    csvLink = $("a[href*='.csv']").attr("href");
  }

  if (!csvLink) {
    logger.warn(`No CSV link found for state ${dbName}. Skipping.`);
    return;
  }

  const csvUrl = new URL(csvLink, "https://prsindia.org").href;
  logger.info(`Downloading CSV from: ${csvUrl}`);

  const { data: csvContent } = await axios.get(csvUrl, { timeout: 60000 });
  const parsedRows = parseCSV(csvContent);

  if (parsedRows.length <= 1) {
    logger.warn(`Empty or invalid CSV for state ${dbName}.`);
    return;
  }

  // Parse headers
  const headers = parsedRows[0].map(h => h.trim().toLowerCase().replace(/^\ufeff/, "")); // Remove BOM if present
  const nameIdx = headers.indexOf("mla name");
  const ageIdx = headers.indexOf("age");
  const constituencyIdx = headers.indexOf("constituency");
  const genderIdx = headers.indexOf("gender");
  const partyIdx = headers.indexOf("party");
  const educationIdx = headers.indexOf("education");
  const attendanceIdx = headers.indexOf("attendance");
  const questionsIdx = headers.indexOf("no. of questions asked");
  const imageIdx = headers.indexOf("image");

  if (nameIdx === -1 || constituencyIdx === -1) {
    logger.error(`CSV headers missing essential columns (MLA Name, Constituency) for state ${dbName}. Headers found: ${headers.join(", ")}`);
    return;
  }

  // Resolve image base URL
  const lastSlashIndex = csvLink.lastIndexOf("/");
  const baseDir = csvLink.substring(0, lastSlashIndex);
  const imageBaseUrl = `https://prsindia.org${baseDir}/mla_images/`;

  // Fetch db candidates and constituencies
  const dbCandidates = await prisma.candidate.findMany({
    where: { stateId: stateRecord.id, type: "MLA" }
  });

  const dbConstituencies = await prisma.constituency.findMany({
    where: { stateId: stateRecord.id }
  });

  const constituencyMap = new Map<string, typeof dbConstituencies[0]>();
  for (const c of dbConstituencies) {
    constituencyMap.set(normalizeConstituencyName(c.name), c);
  }

  const candidateKeyMap = new Map<string, typeof dbCandidates[0]>();
  for (const c of dbCandidates) {
    const key = `${c.constituencyId}_${normalizeCandidateName(c.name)}`;
    candidateKeyMap.set(key, c);
  }

  let updatedCount = 0;
  let addedCount = 0;

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length < Math.max(nameIdx, constituencyIdx)) continue;

    const csvName = row[nameIdx]?.trim();
    const csvConstituency = row[constituencyIdx]?.trim();

    if (!csvName || csvName === "0" || !csvConstituency) continue;

    // Get constituency
    const csvConstituencyNorm = normalizeConstituencyName(csvConstituency);
    let constituencyRecord = constituencyMap.get(csvConstituencyNorm);

    if (!constituencyRecord) {
      constituencyRecord = await prisma.constituency.create({
        data: { name: csvConstituency, stateId: stateRecord.id }
      });
      constituencyMap.set(csvConstituencyNorm, constituencyRecord);
    }

    // Try to find candidate
    const csvNameNorm = normalizeCandidateName(csvName);
    const key = `${constituencyRecord.id}_${csvNameNorm}`;
    let candidateRecord = candidateKeyMap.get(key);

    // Fallback similarity match in same constituency
    if (!candidateRecord) {
      const constituencyCandidates = dbCandidates.filter(c => c.constituencyId === constituencyRecord!.id);
      for (const c of constituencyCandidates) {
        if (isNameSimilar(c.name, csvName)) {
          candidateRecord = c;
          break;
        }
      }
    }

    // Parse attributes
    const csvAttendance = attendanceIdx !== -1 ? parseAttendance(row[attendanceIdx]) : null;
    const csvQuestions = questionsIdx !== -1 ? parseQuestions(row[questionsIdx]) : null;
    const csvAge = ageIdx !== -1 ? parseAge(row[ageIdx]) : null;
    const csvGender = genderIdx !== -1 ? row[genderIdx]?.trim() || null : null;
    const csvEducation = educationIdx !== -1 ? row[educationIdx]?.trim() || null : null;
    const csvParty = partyIdx !== -1 ? row[partyIdx]?.trim() || "Independent" : "Independent";

    const imageFilename = imageIdx !== -1 ? row[imageIdx]?.trim() : "";
    const csvImageUrl = imageFilename && imageFilename.toLowerCase() !== "na" && imageFilename.toLowerCase() !== ""
      ? `${imageBaseUrl}${encodeURIComponent(imageFilename)}`
      : null;

    if (candidateRecord) {
      // Update
      await prisma.candidate.update({
        where: { id: candidateRecord.id },
        data: {
          attendance: csvAttendance,
          questionsAsked: csvQuestions,
          imageUrl: csvImageUrl || candidateRecord.imageUrl,
          age: csvAge || candidateRecord.age,
          gender: csvGender || candidateRecord.gender,
          education: csvEducation || candidateRecord.education
        }
      });
      updatedCount++;
    } else {
      // Create new candidate
      try {
        const newCand = await prisma.candidate.create({
          data: {
            name: csvName,
            stateId: stateRecord.id,
            constituencyId: constituencyRecord.id,
            electionId: electionRecord.id,
            party: csvParty,
            winner: true,
            type: "MLA",
            imageUrl: csvImageUrl,
            age: csvAge,
            gender: csvGender,
            education: csvEducation,
            attendance: csvAttendance,
            questionsAsked: csvQuestions
          }
        });
        // Add to map to prevent duplicates in subsequent rows of the CSV
        candidateKeyMap.set(key, newCand);
        dbCandidates.push(newCand);
        addedCount++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Unique constraint failed! This means a candidate with this name and constituency already exists.
          // Let's find it and update it.
          const existing = await prisma.candidate.findUnique({
            where: { name_constituencyId: { name: csvName, constituencyId: constituencyRecord.id } }
          });
          if (existing) {
            await prisma.candidate.update({
              where: { id: existing.id },
              data: {
                attendance: csvAttendance,
                questionsAsked: csvQuestions,
                imageUrl: csvImageUrl || existing.imageUrl,
                age: csvAge || existing.age,
                gender: csvGender || existing.gender,
                education: csvEducation || existing.education
              }
            });
            updatedCount++;
          }
        } else {
          throw err;
        }
      }
    }
  }

  logger.info(`✅ Successfully processed ${dbName}: Updated ${updatedCount}, Added ${addedCount}`);
}

async function main() {
  logger.info("Starting PRS India Scraper ETL...");

  for (const { dbName, prsName } of statesToScrape) {
    try {
      await scrapeStatePRS(dbName, prsName);
      // Wait 1 second between states to be polite to the server
      await new Promise(r => setTimeout(r, 1000));
    } catch (e: any) {
      logger.error(`Failed to scrape state ${dbName} from PRS. Error: ${e.message}`);
    }
  }

  logger.info("PRS India Scraper ETL finished successfully!");
  process.exit(0);
}

main().catch((e) => {
  logger.error("Scraper crash error:", e);
  process.exit(1);
});
