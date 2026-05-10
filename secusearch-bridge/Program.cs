using System.Net;
using System.Text;
using System.Text.Json;
using SecuGen.SecuSearchSDK3;   // from SecuSearchAPI.Net.dll

// ─────────────────────────────────────────────────────────────────────────────
// BEFORE RUNNING – checklist:
//
//  1. Add to your .csproj:
//       <ItemGroup>
//         <Reference Include="SecuSearchAPI.Net">
//           <HintPath>SecuSearchAPI.Net.dll</HintPath>
//         </Reference>
//       </ItemGroup>
//       <ItemGroup>
//         <None Update="SecuSearchAPI.Net.dll">
//           <CopyToOutputDirectory>Always</CopyToOutputDirectory>
//         </None>
//         <None Update="secusearchapi.dll">
//           <CopyToOutputDirectory>Always</CopyToOutputDirectory>
//         </None>
//         <None Update="secusearchapi32.dll">
//           <CopyToOutputDirectory>Always</CopyToOutputDirectory>
//         </None>
//       </ItemGroup>
//
//  2. Run the terminal / Visual Studio AS ADMINISTRATOR.
//
//  3. Optionally add your Windows user to "Lock pages in memory" in gpedit.msc
//     (Computer Configuration → Windows Settings → Security Settings →
//      User Rights Assignment → Lock pages in memory) then reboot.
//     Without this you get error 2006 but the engine still works up to 1,000 templates.
// ─────────────────────────────────────────────────────────────────────────────

namespace SecuSearchNetBridge
{
    class Program
    {
        private static HttpListener? listener;
        private static SecuSearch?   ssearch;
        private static bool          isInitialized = false;

        // ─────────────────────────────────────────────────────────────────────
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("🔐 SecuSearch Bridge – 1:N Fingerprint Matching");
            Console.WriteLine("================================================");
            Console.WriteLine();
            Console.WriteLine($"🖥  Process : {(Environment.Is64BitProcess ? "64-bit" : "32-bit")}");
            Console.WriteLine($"🖥  OS      : {(Environment.Is64BitOperatingSystem ? "64-bit" : "32-bit")}");
            Console.WriteLine();

            if (!InitializeSecuSearch())
            {
                Console.WriteLine("❌ Failed to initialize. Exiting...");
                return;
            }

            Console.CancelKeyPress += (_, e) =>
            {
                e.Cancel = true;
                Console.WriteLine("\n🛑 Shutting down...");
                listener?.Stop();
                ssearch?.TerminateEngine();
                Environment.Exit(0);
            };

            StartServer();
            await Task.Delay(-1);
        }

        // ─────────────────────────────────────────────────────────────────────
        static bool InitializeSecuSearch()
        {
            try
            {
                ssearch = new SecuSearch();

                // SSParam – managed .NET struct (SDK section 4.5.1)
                // Note: EnableRotation is bool, LicenseFile is string (NOT IntPtr)
                SSParam param = new SSParam
                {
                    Concurrency    = 0,     // 0 = auto-detect all CPU cores
                    CandidateCount = 10,    // max candidates returned per search
                    LicenseFile    = "",    // empty = free mode (≤1,000 templates)
                    EnableRotation = true   // allow any rotation angle
                };

                Console.WriteLine("🔧 Initializing SecuSearch engine (free mode – up to 1,000 templates)...");
                SSError result = ssearch.InitializeEngine(param);

                switch ((int)result)
                {
                    case 0:     // FPS_ERROR_NONE
                        isInitialized = true;
                        Console.WriteLine("✅ SecuSearch engine initialized successfully!");
                        PrintTemplateCount();
                        return true;

                    case 2006:  // FPS_ERROR_SET_LOCK_PAGE_PRIVILEGE
                        Console.WriteLine("⚠️  Error 2006: SE_LOCK_MEMORY privilege not set.");
                        Console.WriteLine("   Run gpedit.msc → Computer Configuration → Windows Settings");
                        Console.WriteLine("   → Security Settings → User Rights Assignment");
                        Console.WriteLine("   → 'Lock pages in memory' → add your account → reboot.");
                        Console.WriteLine("   Continuing anyway (engine works up to 1,000 templates).");
                        isInitialized = true;
                        PrintTemplateCount();
                        return true;

                    case 501:   // FPS_ERROR_LICENSE_LOAD – no license file, free mode
                        Console.WriteLine("⚠️  No license file – running in free mode (≤1,000 templates).");
                        isInitialized = true;
                        PrintTemplateCount();
                        return true;

                    default:
                        Console.WriteLine($"❌ InitializeEngine failed: SSError={result} (code={(int)result})");
                        Console.WriteLine("   Make sure you are running AS ADMINISTRATOR.");
                        return false;
                }
            }
            catch (DllNotFoundException ex)
            {
                Console.WriteLine($"❌ DLL not found: {ex.Message}");
                Console.WriteLine("   Ensure SecuSearchAPI.Net.dll, secusearchapi.dll, and");
                Console.WriteLine("   secusearchapi32.dll are all next to your executable.");
                return false;
            }
            catch (BadImageFormatException ex)
            {
                Console.WriteLine($"❌ Architecture mismatch: {ex.Message}");
                Console.WriteLine("   SecuSearchAPI.Net.dll auto-picks 32/64-bit engine.");
                Console.WriteLine("   Make sure both secusearchapi.dll and secusearchapi32.dll are present.");
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ {ex.GetType().Name}: {ex.Message}");
                return false;
            }
        }

        static void PrintTemplateCount()
        {
            if (ssearch == null) return;
            int count = 0;
            ssearch.GetFPCount(ref count);
            Console.WriteLine($"📊 Templates in database: {count}");
        }

        // ─────────────────────────────────────────────────────────────────────
        static void StartServer()
        {
            listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:8092/");
            listener.Start();

            Console.WriteLine();
            Console.WriteLine("🌐 HTTP server listening on http://localhost:8092/");
            Console.WriteLine();
            Console.WriteLine("Endpoints:");
            Console.WriteLine("  GET  /health    – liveness + template count");
            Console.WriteLine("  GET  /count     – template count only");
            Console.WriteLine("  POST /register  – { \"template\":\"<base64 SG400>\", \"id\":<uint> }");
            Console.WriteLine("  POST /identify  – { \"template\":\"<base64 SG400>\", \"security_level\":1-9 }");
            Console.WriteLine("  POST /search    – { \"template\":\"<base64 SG400>\" }  → candidate list");
            Console.WriteLine("  POST /remove    – { \"id\":<uint> }");
            Console.WriteLine("  GET  /save      – save in-memory DB to secusearch.tdb");
            Console.WriteLine("  GET  /load      – load DB from secusearch.tdb");
            Console.WriteLine("  GET  /clear     – clear all templates from memory");
            Console.WriteLine();
            Console.WriteLine("Templates must be 400-byte SG400 format from SecuGen FDx SDK Pro.");
            Console.WriteLine("Press Ctrl+C to stop.");
            Console.WriteLine();

            listener.BeginGetContext(OnRequest, listener);
        }

        static void OnRequest(IAsyncResult ar)
        {
            if (listener == null || !listener.IsListening) return;
            HttpListenerContext ctx;
            try   { ctx = listener.EndGetContext(ar); }
            catch { return; }
            listener.BeginGetContext(OnRequest, listener);
            _ = Task.Run(() => ProcessRequest(ctx));
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task ProcessRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;
            try
            {
                if (req.HttpMethod == "OPTIONS")
                {
                    SetCors(res); res.StatusCode = 204; res.Close(); return;
                }

                Console.WriteLine($"→ {req.HttpMethod} {req.Url?.AbsolutePath}");

                if (!isInitialized || ssearch == null)
                {
                    await SendJson(res, new { success = false, error = "SecuSearch not initialized" }, 503);
                    return;
                }

                var path = req.Url?.AbsolutePath ?? "";

                if (req.HttpMethod == "GET")
                {
                    await HandleGet(path, res);
                }
                else if (req.HttpMethod == "POST")
                {
                    string body;
                    using (var sr = new StreamReader(req.InputStream, Encoding.UTF8))
                        body = await sr.ReadToEndAsync();
                    await HandlePost(path, body, res);
                }
                else
                {
                    await SendJson(res, new { error = "Method not allowed" }, 405);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Request error: {ex.Message}");
                try { await SendJson(res, new { error = ex.Message }, 500); } catch { }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandleGet(string path, HttpListenerResponse res)
        {
            switch (path)
            {
                case "/health":
                {
                    int count = 0;
                    ssearch!.GetFPCount(ref count);
                    await SendJson(res, new { status = "ok", initialized = true, templates = count });
                    break;
                }
                case "/count":
                {
                    int count = 0;
                    ssearch!.GetFPCount(ref count);
                    await SendJson(res, new { count });
                    break;
                }
                case "/save":
                {
                    SSError err = ssearch!.SaveFPDB("secusearch.tdb");
                    if (err == SSError.NONE)
                        await SendJson(res, new { success = true, file = "secusearch.tdb" });
                    else
                        await SendJson(res, new { success = false, error = $"SSError {(int)err}" }, 500);
                    break;
                }
                case "/load":
                {
                    SSError err = ssearch!.LoadFPDB("secusearch.tdb");
                    if (err == SSError.NONE)
                    {
                        int count = 0;
                        ssearch.GetFPCount(ref count);
                        await SendJson(res, new { success = true, templates = count });
                    }
                    else
                        await SendJson(res, new { success = false, error = $"SSError {(int)err}" }, 500);
                    break;
                }
                case "/clear":
                {
                    SSError err = ssearch!.ClearFPDB();
                    await SendJson(res, err == SSError.NONE
                        ? (object)new { success = true }
                        : new { success = false, error = $"SSError {(int)err}" });
                    break;
                }
                default:
                    await SendJson(res, new { error = "Not found" }, 404);
                    break;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandlePost(string path, string body, HttpListenerResponse res)
        {
            Dictionary<string, JsonElement>? json;
            try   { json = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body); }
            catch { await SendJson(res, new { success = false, error = "Invalid JSON" }, 400); return; }

            if (json == null)
            {
                await SendJson(res, new { success = false, error = "Empty body" }, 400);
                return;
            }

            switch (path)
            {
                case "/extract":  await HandleExtract(json, res);  break;
                case "/register": await HandleRegister(json, res); break;
                case "/identify": await HandleIdentify(json, res); break;
                case "/search":   await HandleSearch(json, res);   break;
                case "/remove":   await HandleRemove(json, res);   break;
                default:          await SendJson(res, new { error = "Unknown endpoint" }, 404); break;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // POST /extract
        // Converts an ISO 19794-2 or ANSI 378 standard template into SG400 format.
        // Body: { "template": "<base64>", "type": "iso" | "ansi", "view": 0 }
        //   type  – "iso" (ISO 19794-2) or "ansi" (ANSI 378). Default: "iso"
        //   view  – zero-based finger view index inside the standard template. Default: 0
        // Returns: { success, sg400: "<base64 400-byte SG400>", views: <total view count> }
        static async Task HandleExtract(Dictionary<string, JsonElement> json, HttpListenerResponse res)
        {
            if (!json.TryGetValue("template", out var tElem))
            {
                await SendJson(res, new { success = false, error = "Missing 'template'" }, 400);
                return;
            }

            byte[]? standardBytes = ParseTemplate(tElem.GetString(), out string? parseErr);
            if (standardBytes == null)
            {
                await SendJson(res, new { success = false, error = parseErr }, 400);
                return;
            }

            // Determine template type
            string typeStr = json.TryGetValue("type", out var typeElem)
                ? (typeElem.GetString() ?? "iso").ToLower()
                : "iso";

            SSTemplateType templateType = typeStr == "ansi"
                ? SSTemplateType.ANSI378
                : SSTemplateType.ISO19794;

            // Determine which view to extract (default 0)
            uint viewIndex = json.TryGetValue("view", out var viewElem) ? viewElem.GetUInt32() : 0u;

            // Get total number of views in the standard template
            uint totalViews = 0;
            SSError countErr = ssearch!.GetNumberOfView(standardBytes, templateType, ref totalViews);
            if (countErr != SSError.NONE)
            {
                Console.WriteLine($"  ❌ GetNumberOfView failed: {countErr} ({(int)countErr})");
                await SendJson(res, new
                {
                    success = false,
                    error   = $"Failed to read template views: {countErr}",
                    code    = (int)countErr
                }, 400);
                return;
            }

            Console.WriteLine($"  📋 Standard template has {totalViews} view(s), extracting view {viewIndex}");

            if (viewIndex >= totalViews)
            {
                await SendJson(res, new
                {
                    success = false,
                    error   = $"View index {viewIndex} out of range. Template has {totalViews} view(s)."
                }, 400);
                return;
            }

            // Extract the requested view into SG400 format (always 400 bytes)
            byte[] sg400 = new byte[400];
            SSError extractErr = ssearch!.ExtractTemplate(standardBytes, templateType, viewIndex, sg400);
            if (extractErr != SSError.NONE)
            {
                Console.WriteLine($"  ❌ ExtractTemplate failed: {extractErr} ({(int)extractErr})");
                await SendJson(res, new
                {
                    success = false,
                    error   = $"Extraction failed: {extractErr}",
                    code    = (int)extractErr
                }, 500);
                return;
            }

            string sg400Base64 = Convert.ToBase64String(sg400);
            Console.WriteLine($"  ✅ Extracted SG400 ({sg400.Length} bytes) from view {viewIndex}/{totalViews}");

            await SendJson(res, new
            {
                success = true,
                sg400   = sg400Base64,
                views   = totalViews,
                view    = viewIndex
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandleRegister(Dictionary<string, JsonElement> json, HttpListenerResponse res)
        {
            if (!json.TryGetValue("template", out var tElem) || !json.TryGetValue("id", out var idElem))
            {
                await SendJson(res, new { success = false, error = "Missing 'template' or 'id'" }, 400);
                return;
            }

            byte[]? bytes = ParseTemplate(tElem.GetString(), out string? err);
            if (bytes == null) { await SendJson(res, new { success = false, error = err }, 400); return; }

            if (bytes.Length != 400)
            {
                await SendJson(res, new
                {
                    success = false,
                    error   = $"Template must be 400 bytes (SG400 format). Got {bytes.Length} bytes."
                }, 400);
                return;
            }

            uint id = idElem.GetUInt32();
            Console.WriteLine($"  📝 Register ID={id}");

            SSError result = ssearch!.RegisterFP(bytes, id);
            if (result == SSError.NONE)
            {
                int count = 0;
                ssearch.GetFPCount(ref count);
                Console.WriteLine($"  ✅ Registered. Total: {count}");
                await SendJson(res, new { success = true, id, total = count });
            }
            else
            {
                Console.WriteLine($"  ❌ Register failed: {result} ({(int)result})");
                await SendJson(res, new { success = false, error = result.ToString(), code = (int)result }, 500);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandleIdentify(Dictionary<string, JsonElement> json, HttpListenerResponse res)
        {
            if (!json.TryGetValue("template", out var tElem))
            {
                await SendJson(res, new { success = false, error = "Missing 'template'" }, 400);
                return;
            }

            byte[]? bytes = ParseTemplate(tElem.GetString(), out string? err);
            if (bytes == null) { await SendJson(res, new { success = false, error = err }, 400); return; }

            // Security level 1-9; default 5 = CONF_LEVEL_NORMAL
            uint raw = json.TryGetValue("security_level", out var lvl) ? lvl.GetUInt32() : 5u;
            raw = Math.Clamp(raw, 1u, 9u);
            SSConfLevel secLevel = (SSConfLevel)raw;

            Console.WriteLine($"  🔍 Identify (security_level={raw})");

            uint matchedId = 0;
            SSError result = ssearch!.IdentifyFP(bytes, secLevel, ref matchedId);

            if (result == SSError.NONE)
            {
                Console.WriteLine($"  ✅ Match found: ID={matchedId}");
                await SendJson(res, new { success = true, matched_id = matchedId });
            }
            else if ((int)result == 202)  // FPS_ERROR_IDENTIFICATION_FAIL
            {
                Console.WriteLine("  ℹ️  No match found.");
                await SendJson(res, new { success = false, matched_id = 0, error = "No match found" });
            }
            else
            {
                Console.WriteLine($"  ❌ Identify error: {result} ({(int)result})");
                await SendJson(res, new { success = false, error = result.ToString(), code = (int)result }, 500);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandleSearch(Dictionary<string, JsonElement> json, HttpListenerResponse res)
        {
            if (!json.TryGetValue("template", out var tElem))
            {
                await SendJson(res, new { success = false, error = "Missing 'template'" }, 400);
                return;
            }

            byte[]? bytes = ParseTemplate(tElem.GetString(), out string? err);
            if (bytes == null) { await SendJson(res, new { success = false, error = err }, 400); return; }

            Console.WriteLine("  🔍 Search (candidate list)");

            SSCandList candList = new SSCandList();
            SSError result = ssearch!.SearchFP(bytes, ref candList);

            if (result == SSError.NONE)
            {
                // Per SDK: confidence > 5 means the fingerprints match
                var candidates = candList.Candidates
                    .Take(candList.Count)
                    .Select(c => new
                    {
                        id           = c.Id,                          // PascalCase in actual DLL
                        match_score  = c.MatchScore,
                        confidence   = c.ConfidenceLevel,
                        is_match     = (int)c.ConfidenceLevel > 5     // cast enum to int for comparison
                    })
                    .ToArray();

                Console.WriteLine($"  ✅ Search done. Candidates: {candList.Count}");
                await SendJson(res, new { success = true, count = candList.Count, candidates });
            }
            else
            {
                Console.WriteLine($"  ❌ Search error: {result} ({(int)result})");
                await SendJson(res, new { success = false, error = result.ToString(), code = (int)result }, 500);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static async Task HandleRemove(Dictionary<string, JsonElement> json, HttpListenerResponse res)
        {
            if (!json.TryGetValue("id", out var idElem))
            {
                await SendJson(res, new { success = false, error = "Missing 'id'" }, 400);
                return;
            }

            uint id = idElem.GetUInt32();
            Console.WriteLine($"  🗑  Remove ID={id}");

            SSError result = ssearch!.RemoveFP(id);
            if (result == SSError.NONE)
            {
                int count = 0;
                ssearch.GetFPCount(ref count);
                Console.WriteLine($"  ✅ Removed. Total: {count}");
                await SendJson(res, new { success = true, id, total = count });
            }
            else
            {
                Console.WriteLine($"  ❌ Remove failed: {result} ({(int)result})");
                await SendJson(res, new { success = false, error = result.ToString(), code = (int)result }, 500);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        static byte[]? ParseTemplate(string? b64, out string? error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(b64)) { error = "Empty template"; return null; }
            try   { return Convert.FromBase64String(b64); }
            catch { error = "Invalid base64 template"; return null; }
        }

        static async Task SendJson(HttpListenerResponse res, object data, int status = 200)
        {
            SetCors(res);
            res.StatusCode  = status;
            res.ContentType = "application/json; charset=utf-8";
            var buf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(data));
            res.ContentLength64 = buf.Length;
            await res.OutputStream.WriteAsync(buf);
            res.OutputStream.Close();
        }

        static void SetCors(HttpListenerResponse res)
        {
            res.Headers.Set("Access-Control-Allow-Origin",  "*");
            res.Headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Set("Access-Control-Allow-Headers", "Content-Type");
        }
    }
}