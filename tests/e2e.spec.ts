import { test, expect } from "@playwright/test";

test.describe("CoachOS E2E Flow", () => {
  const randomId = Math.floor(Math.random() * 1000000);
  const trainerEmail = `trainer-${randomId}@example.com`;
  const trainerPassword = "password123";
  const teamName = `E2E Test Team ${randomId}`;
  
  test("complete flow: signup -> workspace -> player checkin -> export -> deletion", async ({ page }) => {
    // 1. Trainer Signup
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    
    // Fill the signup form (Account erstellen)
    await page.fill("#signup-email", trainerEmail);
    await page.fill("#signup-password", trainerPassword);
    if (process.env.COACH_SIGNUP_CODE) {
      await page.fill("#signup-code", process.env.COACH_SIGNUP_CODE);
    }
    
    // Click 'Account erstellen' button
    await page.click('form:has(#signup-email) button[type="submit"]');
    
    // Signup feedback is rendered inline; the page no longer redirects.
    await expect(page.locator("#signup-message")).toBeVisible({
      timeout: 30_000
    });
    
    // 2. Trainer Login
    // Fill the signin form (Einloggen)
    await page.fill("#signin-email", trainerEmail);
    await page.fill("#signin-password", trainerPassword);
    
    // Click 'Einloggen'
    await page.click('form:has(#signin-email) button[type="submit"]');
    
    // Successful login for a new user with no workspace redirects to /workspaces
    await page.waitForURL(/\/workspaces/);
    await expect(page).toHaveURL(/\/workspaces/);
    
    // 3. Create Workspace
    // Fill new workspace form
    await page.fill("#new-name", teamName);
    await page.fill("#new-season", "2026/2027");
    await page.fill("#new-age", "U17");
    
    // Click 'Workspace erstellen'
    await page.click('button:has-text("Workspace erstellen")');
    
    // Redirection to Dashboard (/) after workspace creation
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
    
    // 4. Navigate to Players Page and get Invite Link
    await page.goto("/players");
    await page.waitForLoadState("networkidle");
    
    // Find the preview button link
    const previewLinkLocator = page.locator('a:has-text("Vorschau öffnen")');
    await expect(previewLinkLocator).toBeVisible();
    const joinHref = await previewLinkLocator.getAttribute("href");
    expect(joinHref).not.toBeNull();
    
    // 5. Navigate to Player self-registration (Join Page)
    await page.goto(joinHref!);
    await page.waitForLoadState("networkidle");
    
    // Fill player self-registration form
    await page.fill("#first_name", "Max");
    await page.fill("#last_name", "Mustermann");
    await page.fill("#position", "Mittelfeld");
    await page.fill("#jersey_number", "10");
    await page.fill("#parent_contact", "eltern@example.com");
    await page.check("#consent");
    
    // Submit registration
    await page.click('button:has-text("Anmelden und Link erhalten")');
    
    // Wait for the success state on join page
    await expect(page.locator('h2:has-text("Willkommen, Max!")')).toBeVisible();
    
    // Click 'Direkt öffnen' to go to player dashboard
    await page.click('button:has-text("Direkt öffnen")');
    
    // The one-time player link is exchanged for a revocable device session.
    await page.waitForURL(/\/player$/);
    
    // 6. Player Check-in
    // Check that check-in section is visible and wie fühlst du dich heute is displayed
    await expect(page.locator('p:has-text("Wie fühlst du dich heute?")')).toBeVisible();
    
    // Select motivation to be 4/5 (under motivation radio group)
    // Find the scale input/button for wellbeing, fatigue, sleep, pain etc.
    // We can select the buttons in the check-in form.
    // Let's just click 'Check-in speichern' to submit with default scale values
    await page.click('button:has-text("Check-in speichern")');
    
    // Expect success toast or check-in to be marked done
    await expect(page.locator('p:has-text("Check-in erledigt")')).toBeVisible();

    // 7. Export the complete workspace archive as its owner
    await page.goto("/workspaces");
    const exportLink = page.getByRole("link", {
      name: "Datenarchiv herunterladen"
    });
    const exportHref = await exportLink.getAttribute("href");
    expect(exportHref).not.toBeNull();
    const exportResponse = await page.request.get(exportHref!);
    expect(exportResponse.ok()).toBeTruthy();
    const archive = await exportResponse.json();
    expect(archive.workspace.name).toBe(teamName);
    expect(archive.players).toHaveLength(1);
    expect(JSON.stringify(archive)).not.toContain("accessToken");
    expect(JSON.stringify(archive)).not.toContain("passwordHash");

    // 8. Destructive deletion requires both the exact name and re-authentication
    await page.fill("#delete-workspace-name", teamName);
    await page.fill("#delete-workspace-password", trainerPassword);
    await page.getByRole("button", {
      name: "Workspace endgültig löschen"
    }).click();
    await page.waitForURL(/\/workspaces\?message=/);
    await expect(page.getByText(/wurde dauerhaft gelöscht/)).toBeVisible();
    await expect(page.getByText("Noch kein Workspace.")).toBeVisible();

    // 9. With no owned workspace left, the trainer can delete the account.
    await page.goto("/account");
    await page.fill("#delete-account-email", trainerEmail);
    await page.fill("#delete-account-password", trainerPassword);
    await page.getByRole("button", {
      name: "Konto endgültig löschen"
    }).click();
    await page.waitForURL(/\/login\?account=deleted/);
    await expect(
      page.getByText(/CoachOS-Konto wurde dauerhaft gelöscht/)
    ).toBeVisible();
  });
});
