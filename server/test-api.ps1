# VíaBaq API Testing Script for PowerShell
# Run this from the server directory: .\test-api.ps1

$BASE_URL = "http://localhost:4000/api/v1"
$HEALTH_URL = "http://localhost:4000/health"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VíaBaq API Testing Script (Windows)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Color functions
function Write-Success { param($message) Write-Host "✅ $message" -ForegroundColor Green }
function Write-Info { param($message) Write-Host "📋 $message" -ForegroundColor Blue }
function Write-Error { param($message) Write-Host "❌ $message" -ForegroundColor Red }
function Write-Section { param($message) Write-Host "`n🔹 $message" -ForegroundColor Yellow }

# Helper function to make requests and format output
function Test-Endpoint {
    param(
        [string]$Method = "GET",
        [string]$Url,
        [string]$Description,
        [string]$Body = $null
    )

    Write-Section $Description
    Write-Info "URL: $Url"

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            UseBasicParsing = $true
        }

        if ($Body) {
            $params.Body = $Body
        }

        $response = Invoke-WebRequest @params

        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            Write-Success "Status: $($response.StatusCode)"
            $jsonResponse = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
            Write-Host $jsonResponse -ForegroundColor White
        } else {
            Write-Error "Status: $($response.StatusCode)"
        }
    }
    catch {
        Write-Error "Request failed: $($_.Exception.Message)"
    }

    Write-Host ""
}

# 1. Health Check
Test-Endpoint -Url $HEALTH_URL -Description "Health Check"

# 2. Geographical Zones
Test-Endpoint -Url "$BASE_URL/geo/zones" -Description "Get All Zones"

# 3. Roads
Test-Endpoint -Url "$BASE_URL/geo/roads" -Description "Get All Roads"

# 4. Arroyo Zones (flood-prone areas)
Test-Endpoint -Url "$BASE_URL/geo/arroyo-zones" -Description "Get Arroyo Zones"

# 5. Points of Interest
Test-Endpoint -Url "$BASE_URL/geo/pois" -Description "Get Points of Interest"

# 6. Weather Data
Test-Endpoint -Url "$BASE_URL/weather/current" -Description "Get Current Weather"

# 7. Traffic Data
Test-Endpoint -Url "$BASE_URL/traffic/current" -Description "Get Current Traffic"

# 8. Events
Test-Endpoint -Url "$BASE_URL/events" -Description "Get All Events"
Test-Endpoint -Url "$BASE_URL/events/upcoming" -Description "Get Upcoming Events"

# 9. Analytics - Traffic Patterns
Test-Endpoint -Url "$BASE_URL/analytics/traffic/patterns?period=day" -Description "Get Traffic Patterns (Day)"

# 10. Analytics - Hotspots
Test-Endpoint -Url "$BASE_URL/analytics/traffic/hotspots?limit=5" -Description "Get Top 5 Traffic Hotspots"

# 11. Analytics - Weather Impact
Test-Endpoint -Url "$BASE_URL/analytics/weather/impact" -Description "Get Weather Impact on Traffic"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ API Testing Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "  - The backend must be running (npm run dev)" -ForegroundColor Gray
Write-Host "  - Check http://localhost:4000/health for server status" -ForegroundColor Gray
Write-Host "  - All data is currently using mock/seed data" -ForegroundColor Gray
Write-Host ""