param(
    [string]$BaseUrl = 'http://127.0.0.1:8010'
)

$ErrorActionPreference = 'Stop'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$email = "php-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@example.test"
$script:csrfToken = ''

function Invoke-JsonRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body
    )

    $parameters = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        WebSession = $session
        Headers = @{
            Accept = 'application/json'
        }
    }
    if ($script:csrfToken -and $Method -notin @('GET', 'HEAD', 'OPTIONS')) {
        $parameters.Headers['X-CSRF-Token'] = $script:csrfToken
    }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = $Body | ConvertTo-Json -Depth 12 -Compress
    }
    $response = Invoke-RestMethod @parameters
    if ($response.PSObject.Properties.Name -contains 'csrfToken' -and $response.csrfToken) {
        $script:csrfToken = [string]$response.csrfToken
    }
    return $response
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw "Smoke test failed: $Message"
    }
}

$health = Invoke-JsonRequest -Method GET -Path '/api/health'
Assert-True $health.success 'health endpoint'

$register = Invoke-JsonRequest -Method POST -Path '/api/auth/register' -Body @{
    firstName = 'Aisyah'
    lastName = 'Rahman'
    email = $email
    phone = '+60 12-345 6789'
    address = '43000, Selangor, Malaysia'
    password = 'Testing123!'
    confirmPassword = 'Testing123!'
}
Assert-True ($register.success -and $register.authenticated) 'registration and session'
$script:csrfToken = [string]$register.csrfToken
Assert-True ($script:csrfToken.Length -eq 64) 'CSRF token issued after authentication'

$me = Invoke-JsonRequest -Method GET -Path '/api/auth/me'
Assert-True ($me.success -and $me.user.email -eq $email) 'authenticated user'

$aiStatus = Invoke-JsonRequest -Method GET -Path '/api/ai/status'
Assert-True ($aiStatus.success -and $null -ne $aiStatus.enabled) 'authenticated AI availability check'

$locations = Invoke-JsonRequest -Method GET -Path '/api/lookups/locations?q=Kuala&country=Malaysia'
Assert-True ($locations.success -and $locations.results.Count -gt 0) 'local location lookup'

$created = Invoke-JsonRequest -Method POST -Path '/api/dashboard' -Body @{ title = 'Production Smoke Resume' }
$resumeId = [int]$created.data.id
Assert-True ($created.success -and $resumeId -gt 0) 'primary resume creation'

$personal = Invoke-JsonRequest -Method POST -Path "/api/resume/$resumeId/section" -Body @{
    section = 'personal'
    data = @{
        fullName = 'Nur Aisyah Binti Rahman'
        jobTitle = 'Junior Software Engineer'
        email = $email
        phone = '+60 12-345 6789'
        linkedin = 'linkedin.com/in/aisyah-rahman'
        locationCountry = 'Malaysia'
        locationState = 'Selangor'
        postcode = '43000'
    }
}
Assert-True $personal.success 'personal section save'

$summary = Invoke-JsonRequest -Method POST -Path "/api/resume/$resumeId/section" -Body @{
    section = 'summary'
    data = 'Software engineering graduate focused on secure and accessible web applications.'
}
Assert-True $summary.success 'summary section save'

$education = Invoke-JsonRequest -Method POST -Path "/api/resume/$resumeId/section" -Body @{
    section = 'education'
    data = @(@{
        degree = 'Bachelor of Computer Science'
        institution = 'Universiti Teknologi Malaysia'
        location = 'Johor Bahru, Malaysia'
        cgpa = '3.78 / 4.00'
        academicResultType = 'cgpa'
        startDate = '2021-09'
        endDate = '2025-06'
    })
}
Assert-True $education.success 'education section save'

$skills = Invoke-JsonRequest -Method POST -Path "/api/resume/$resumeId/section" -Body @{
    section = 'skills'
    data = @{
        technical = 'PHP, JavaScript, MySQL'
        software = 'GitHub, Figma'
        interpersonal = 'Communication, teamwork'
        language = 'Malay, English'
        custom = @()
    }
}
Assert-True $skills.success 'skills section save'

$atsState = Invoke-JsonRequest -Method GET -Path "/api/resume/$resumeId/ats-review"
Assert-True (
    $atsState.success `
        -and $atsState.review.score -ge 0 `
        -and $atsState.review.score -le 100 `
        -and $atsState.review.aiEnhanced -eq $false
) 'read-only ATS state'

$ats = Invoke-JsonRequest -Method POST -Path "/api/resume/$resumeId/ats-review" -Body @{}
Assert-True (
    $ats.success `
        -and $ats.review.score -ge 0 `
        -and $ats.review.score -le 100 `
        -and $ats.review.checks.Count -ge 8
) 'ATS readiness review'

$savedAtsState = Invoke-JsonRequest -Method GET -Path "/api/resume/$resumeId/ats-review"
Assert-True (
    $savedAtsState.success `
        -and $savedAtsState.review.score -eq $ats.review.score
) 'ATS state remains available without regeneration'

$resume = Invoke-JsonRequest -Method GET -Path "/api/resume/$resumeId"
Assert-True ($resume.success -and $resume.data.personal.fullName -eq 'Nur Aisyah Binti Rahman') 'resume reload'

$photoPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\tmp')).Path 'http-smoke-photo.png'
$photoBytes = [Convert]::FromBase64String(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
)
[System.IO.File]::WriteAllBytes($photoPath, $photoBytes)
$sessionCookie = $session.Cookies.GetCookies([Uri]$BaseUrl) |
    Where-Object { $_.Name -eq 'regen_sid' } |
    Select-Object -First 1
Assert-True ($null -ne $sessionCookie) 'PHP session cookie'
$photoResponse = curl.exe -sS `
    -b "$($sessionCookie.Name)=$($sessionCookie.Value)" `
    -H "X-CSRF-Token: $script:csrfToken" `
    -F "photo=@$photoPath;type=image/png" `
    "$BaseUrl/api/resume/$resumeId/photo" | ConvertFrom-Json
Assert-True ($photoResponse.success -and $photoResponse.photoBase64.StartsWith('data:image/png;base64,')) 'photo upload'

$deletePhoto = Invoke-JsonRequest -Method DELETE -Path "/api/resume/$resumeId/photo"
Assert-True $deletePhoto.success 'photo delete'

$dashboard = Invoke-JsonRequest -Method GET -Path '/api/dashboard'
Assert-True ($dashboard.success -and $dashboard.profile.completion -ge 85) 'dashboard profile calculation'

$preview = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/pdf/$resumeId/preview" -WebSession $session
Assert-True ($preview.StatusCode -eq 200 -and $preview.Content.Contains('Nur Aisyah Binti Rahman')) 'HTML preview'

$draft = Invoke-WebRequest -UseBasicParsing `
    -Uri "$BaseUrl/api/pdf/$resumeId/preview-data" `
    -Method POST `
    -WebSession $session `
    -Headers @{ 'X-CSRF-Token' = $script:csrfToken } `
    -ContentType 'application/json' `
    -Body (@{ resumeData = @{ summary = 'Unsaved preview draft text.' } } | ConvertTo-Json -Depth 5 -Compress)
Assert-True ($draft.StatusCode -eq 200 -and $draft.Content.Contains('Unsaved preview draft text.')) 'draft preview'

$pdfPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\tmp')).Path 'http-smoke-resume.pdf'
$pdf = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/pdf/$resumeId/generate" -WebSession $session -OutFile $pdfPath -PassThru
$pdfBytes = [System.IO.File]::ReadAllBytes($pdfPath)
$signature = [System.Text.Encoding]::ASCII.GetString($pdfBytes, 0, [Math]::Min(4, $pdfBytes.Length))
Assert-True ($pdf.Headers['Content-Type'] -eq 'application/pdf' -and $signature -eq '%PDF') 'PDF download'

$rename = Invoke-JsonRequest -Method PATCH -Path "/api/dashboard/$resumeId/title" -Body @{ title = 'Renamed Resume' }
Assert-True $rename.success 'resume rename'

$logout = Invoke-JsonRequest -Method POST -Path '/api/auth/logout'
Assert-True $logout.success 'logout'

Write-Output "PHP HTTP smoke test passed (resume ID: $resumeId, PDF bytes: $($pdfBytes.Length))."
