/**
 * OpenTable Restaurant Reservation Automation
 * 
 * Automatically searches for and books restaurant reservations on OpenTable.com
 * Uses AI-powered web automation via Stagehand for intelligent element detection.
 */

import { Stagehand, ConstructorParams } from "@browserbasehq/stagehand";
import * as chrono from "chrono-node";
import { DateTime } from "luxon";

// ========== Types & Configuration ==========

type BookingIntent = {
  restaurant: string;
  party: number;
  dateISO: string;
  time24: string;
};

const PHONE = process.env.OPEN_TABLE_PHONE ?? "";
const DEFAULT_MESSAGE = "book me a reservation at Terra E Mare tomorrow at 7pm for 2";

// ========== Utility Functions ==========

function parseMessage(msg: string, tz = "America/Los_Angeles"): BookingIntent {
  // Extract restaurant name
  const restaurantMatch = 
    msg.match(/(?:at|for)\s+(.+?)(?=\s+(?:today|tomorrow|on|\d{1,2}[:\s]\d{2}|am|pm|for\s+\d+)|$)/i) ||
    msg.match(/(?:reserve|book)\s+(?:a\s+table|a\s+reservation)?\s*at\s+(.+?)(?=$)/i);
  const restaurant = (restaurantMatch ? restaurantMatch[1] : msg).trim();

  // Extract party size
  const partyMatch = msg.match(/\b(?:for|party\s*of)\s*(\d+)\b/i);
  const party = partyMatch ? Math.max(1, parseInt(partyMatch[1], 10)) : 2;

  // Extract date and time
  const parsed = chrono.parse(msg, new Date(), { forwardDate: true });
  let dt = DateTime.fromJSDate(parsed[0]?.date() ?? new Date()).setZone(tz);
  
  const hasTime = /(\d{1,2}(:\d{2})?\s*(am|pm))\b/i.test(msg) || /\bnoon\b/i.test(msg);
  if (!hasTime) dt = dt.set({ hour: 19, minute: 0 }); // Default to 7 PM

  return {
    restaurant,
    party,
    dateISO: dt.toISODate()!,
    time24: dt.toFormat("HH:mm")
  };
}

function to12hr(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function humanDate(dateISO: string): string {
  return DateTime.fromISO(dateISO).toFormat("MMM d, yyyy");
}

// ========== Restaurant Search & Navigation ==========

async function searchAndNavigateToRestaurant(page: any, restaurantName: string): Promise<void> {
  console.log(`Searching for restaurant: ${restaurantName}`);
  
  try {
    // AI-powered search approach
    console.log("Using AI to search and navigate...");
    await page.act(`Find the main search input on this OpenTable homepage and search for "${restaurantName}". If suggestions appear, click the matching restaurant, otherwise submit the search.`);
    await page.waitForTimeout(3000);
    
    // Handle submission if still on homepage
    if (page.url() === "https://www.opentable.com/") {
      console.log("Submitting search...");
      await page.act(`Click the search button or press Enter to submit the search for "${restaurantName}"`);
      await page.waitForTimeout(3000);
    }
    
    // Navigate from search results to restaurant page
    if (/\/s\?/.test(page.url())) {
      console.log("Clicking restaurant from search results...");
      await page.act(`Click on the restaurant card or link for "${restaurantName}"`);
      await page.waitForTimeout(2000);
    }
    
  } catch (error) {
    console.log("AI search failed:", error.message);
    console.log("Continuing with available options...");
  }
}

// ========== Reservation Booking Process ==========

async function setReservationDetails(page: any, intent: BookingIntent): Promise<void> {
  console.log("Setting reservation details...");
  
  const dateHuman = humanDate(intent.dateISO);
  const timeHuman = to12hr(intent.time24);
  
  try {
    await page.act(
      `On this restaurant page, set party size to ${intent.party}, set date to "${dateHuman}", set time to "${timeHuman}", then refresh availability.`
    );
  } catch (error) {
    console.log("Could not set reservation details:", error.message);
  }
}

async function selectTimeSlot(page: any, targetTime: string): Promise<boolean> {
  const timeHuman = to12hr(targetTime);
  console.log(`Looking for time slot near: ${timeHuman}`);

  try {
    await page.act(`Scroll to the "Select a time" section, then click the visible reservation time closest to ${timeHuman}.`);
    console.log("Time slot selected successfully");
    return true;
  } catch (error) {
    console.log("Could not select time slot:", error.message);
    return false;
  }
}

async function selectSeatingOption(page: any): Promise<void> {
  console.log("Selecting seating option...");
  
  try {
    await page.act("Select the 'Standard' seating option and proceed to the next step");
    console.log("Seating option selected");
  } catch (error) {
    console.log("Could not select seating:", error.message);
  }
}

async function fillGuestInformation(page: any): Promise<void> {
  console.log("Filling guest details...");
  
  const guestName = "John Smith";
  const guestEmail = "john.smith@example.com";
  
  try {
    await page.act(`Fill in the guest details form with name "${guestName}" and email "${guestEmail}". Do not create an account.`);
    console.log("Guest details filled");
  } catch (error) {
    console.log("Could not fill guest details:", error.message);
  }
}

async function fillPhoneNumber(page: any): Promise<void> {
  if (!PHONE) return;
  
  console.log("Filling phone number...");
  try {
    await page.act(`If a phone number field is visible, enter "${PHONE}" (US format). Do not attempt to log in.`);
  } catch (error) {
    console.log("Could not fill phone number:", error.message);
  }
}

async function completeReservation(page: any): Promise<void> {
  console.log("Completing reservation...");
  
  try {
    // First check and accept terms and conditions if present
    console.log("Checking for terms and conditions...");
    await page.act("If there is a terms and conditions checkbox, check it to agree to the terms");
    await page.waitForTimeout(1000);
    
    // Then complete the reservation
    await page.act("Complete the reservation by clicking the final confirmation or 'Complete Reservation' button");
    console.log("Reservation completed");
  } catch (error) {
    console.log("Could not complete reservation:", error.message);
  }
}

// ========== Main Execution Flow ==========

async function main(): Promise<void> {
  const message = process.argv.slice(2).join(" ").trim() || DEFAULT_MESSAGE;
  
  console.log("Starting reservation:", message);
  const intent = parseMessage(message);
  console.log("Parsed intent:", intent);

  const config: ConstructorParams = { 
    env: "LOCAL", 
    verbose: 1 
  };

  console.log("Initializing Stagehand...");
  const stagehand = new Stagehand(config);
  await stagehand.init();
  const page = stagehand.page;

  try {
    // Step 1: Navigate to OpenTable
    console.log("Navigating to OpenTable...");
    await page.goto("https://www.opentable.com/", { waitUntil: "domcontentloaded" });
    
    // Step 2: Search for restaurant
    await searchAndNavigateToRestaurant(page, intent.restaurant);
    console.log("Restaurant page loaded:", page.url());
    
    // Step 3: Set reservation details
    await setReservationDetails(page, intent);
    
    // Step 4: Select time slot
    const timeSelected = await selectTimeSlot(page, intent.time24);
    
    if (timeSelected) {
      console.log("Time slot selected, proceeding with booking...");
      
      // Step 5: Complete booking process
      await selectSeatingOption(page);
      await fillGuestInformation(page);
      await fillPhoneNumber(page);
      await completeReservation(page);
      
      console.log("Full reservation process completed!");
    } else {
      console.log("Could not select time slot - process stopped");
    }

    console.log("Final URL:", page.url());
    
    // Keep browser open briefly to see final state
    console.log("Keeping browser open for 10 seconds...");
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error("Error in main flow:", error);
  } finally {
    console.log("Closing browser...");
    await stagehand.close();
  }
}

// ========== Entry Point ==========

main().catch((error) => {
  console.error("Failed to run automation:", error);
  process.exit(1);
});