using System;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace StudyStation.Windows.Companion
{
    public class Program
    {
        private const int Port = 48231;
        private static HttpListener? _listener;
        private static bool _isRunning = true;

        // Recording state
        private static bool _isRecording = false;
        private static bool _isPaused = false;
        private static DateTime _startTime = DateTime.MinValue;
        private static TimeSpan _accumulatedTime = TimeSpan.Zero;
        private static string _currentRecordingPath = string.Empty;
        private static FileStream? _audioFileStream;
        private static readonly object _stateLock = new();

        // Windows Kernel execution state flags (keeps recording active during lock & standby)
        [Flags]
        private enum ExecutionState : uint
        {
            ES_AWAYMODE_REQUIRED = 0x00000040,
            ES_CONTINUOUS = 0x80000000,
            ES_SYSTEM_REQUIRED = 0x00000001
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern ExecutionState SetThreadExecutionState(ExecutionState esFlags);

        public static async Task Main(string[] args)
        {
            Console.WriteLine("==================================================");
            Console.WriteLine("  StudyStation Windows Background Audio Companion ");
            Console.WriteLine("  Port: " + Port);
            Console.WriteLine("==================================================");

            string storageDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "StudyStation",
                "Recordings"
            );
            Directory.CreateDirectory(storageDir);

            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://127.0.0.1:{Port}/");

            try
            {
                _listener.Start();
                Console.WriteLine($"[Companion] Listening on http://127.0.0.1:{Port}/");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Companion] Failed to start HTTP listener: {ex.Message}");
                return;
            }

            // Handle requests
            while (_isRunning)
            {
                try
                {
                    var context = await _listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequestAsync(context));
                }
                catch (HttpListenerException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Companion] Request error: {ex.Message}");
                }
            }
        }

        private static async Task HandleRequestAsync(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            // Allow CORS from StudyStation web app and localhost
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            string path = req.Url?.AbsolutePath.ToLowerInvariant() ?? "";

            try
            {
                switch (path)
                {
                    case "/api/health":
                        await SendJsonResponseAsync(res, 200, new
                        {
                            service = "StudyStation.Windows.Companion",
                            status = "ok",
                            version = "1.0.0"
                        });
                        break;

                    case "/api/status":
                        lock (_stateLock)
                        {
                            int elapsed = (int)_accumulatedTime.TotalSeconds;
                            if (_isRecording && !_isPaused)
                            {
                                elapsed += (int)(DateTime.UtcNow - _startTime).TotalSeconds;
                            }

                            long freeSpace = 0;
                            try
                            {
                                var drive = new DriveInfo(Path.GetPathRoot(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)) ?? "C");
                                freeSpace = drive.AvailableFreeSpace;
                            }
                            catch { }

                            SendJsonResponse(res, 200, new
                            {
                                isRecording = _isRecording,
                                isPaused = _isPaused,
                                elapsedSeconds = elapsed,
                                diskSpaceAvailableBytes = freeSpace,
                                version = "1.0.0"
                            });
                        }
                        break;

                    case "/api/record/start":
                        if (req.HttpMethod == "POST")
                        {
                            lock (_stateLock)
                            {
                                if (_isRecording)
                                {
                                    SendJsonResponse(res, 409, new { error = "Recording is already active." });
                                    return;
                                }

                                string storageDir = Path.Combine(
                                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                                    "StudyStation",
                                    "Recordings"
                                );
                                Directory.CreateDirectory(storageDir);

                                _currentRecordingPath = Path.Combine(storageDir, $"lecture_{DateTime.UtcNow:yyyyMMdd_HHmmss}.wav");
                                _audioFileStream = new FileStream(_currentRecordingPath, FileMode.Create, FileAccess.Write, FileShare.Read);
                                WriteWavHeaderPlaceholder(_audioFileStream);

                                _isRecording = true;
                                _isPaused = false;
                                _startTime = DateTime.UtcNow;
                                _accumulatedTime = TimeSpan.Zero;

                                // Prevent Windows from sleeping or suspending thread during lock/standby
                                SetThreadExecutionState(ExecutionState.ES_CONTINUOUS | ExecutionState.ES_SYSTEM_REQUIRED | ExecutionState.ES_AWAYMODE_REQUIRED);
                            }

                            await SendJsonResponseAsync(res, 200, new { success = true, path = _currentRecordingPath });
                        }
                        else
                        {
                            res.StatusCode = 405;
                            res.Close();
                        }
                        break;

                    case "/api/record/pause":
                        lock (_stateLock)
                        {
                            if (_isRecording && !_isPaused)
                            {
                                _accumulatedTime += (DateTime.UtcNow - _startTime);
                                _isPaused = true;
                            }
                        }
                        SendJsonResponse(res, 200, new { success = true, isPaused = true });
                        break;

                    case "/api/record/resume":
                        lock (_stateLock)
                        {
                            if (_isRecording && _isPaused)
                            {
                                _startTime = DateTime.UtcNow;
                                _isPaused = false;
                                SetThreadExecutionState(ExecutionState.ES_CONTINUOUS | ExecutionState.ES_SYSTEM_REQUIRED | ExecutionState.ES_AWAYMODE_REQUIRED);
                            }
                        }
                        SendJsonResponse(res, 200, new { success = true, isPaused = false });
                        break;

                    case "/api/record/stop":
                        string savedFile = string.Empty;
                        lock (_stateLock)
                        {
                            if (!_isRecording)
                            {
                                SendJsonResponse(res, 400, new { error = "No recording active." });
                                return;
                            }

                            _isRecording = false;
                            _isPaused = false;
                            savedFile = _currentRecordingPath;

                            if (_audioFileStream != null)
                            {
                                FinalizeWavHeader(_audioFileStream);
                                _audioFileStream.Flush();
                                _audioFileStream.Close();
                                _audioFileStream.Dispose();
                                _audioFileStream = null;
                            }

                            // Release Windows sleep prevention
                            SetThreadExecutionState(ExecutionState.ES_CONTINUOUS);
                        }

                        if (File.Exists(savedFile))
                        {
                            res.ContentType = "audio/wav";
                            res.StatusCode = 200;
                            using (var file = File.OpenRead(savedFile))
                            {
                                res.ContentLength64 = file.Length;
                                await file.CopyToAsync(res.OutputStream);
                            }
                            res.Close();
                        }
                        else
                        {
                            SendJsonResponse(res, 404, new { error = "Audio file not found." });
                        }
                        break;

                    default:
                        res.StatusCode = 404;
                        res.Close();
                        break;
                }
            }
            catch (Exception ex)
            {
                SendJsonResponse(res, 500, new { error = ex.Message });
            }
        }

        private static void SendJsonResponse(HttpListenerResponse res, int statusCode, object data)
        {
            res.StatusCode = statusCode;
            res.ContentType = "application/json; charset=utf-8";
            byte[] bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(data));
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static async Task SendJsonResponseAsync(HttpListenerResponse res, int statusCode, object data)
        {
            res.StatusCode = statusCode;
            res.ContentType = "application/json; charset=utf-8";
            byte[] bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(data));
            res.ContentLength64 = bytes.Length;
            await res.OutputStream.WriteAsync(bytes, 0, bytes.Length);
            res.Close();
        }

        private static void WriteWavHeaderPlaceholder(FileStream stream)
        {
            byte[] header = new byte[44];
            stream.Write(header, 0, 44);
        }

        private static void FinalizeWavHeader(FileStream stream)
        {
            long dataLength = stream.Length - 44;
            if (dataLength < 0) dataLength = 0;

            int sampleRate = 16000;
            short channels = 1;
            short bitsPerSample = 16;
            int byteRate = sampleRate * channels * (bitsPerSample / 8);
            short blockAlign = (short)(channels * (bitsPerSample / 8));

            stream.Seek(0, SeekOrigin.Begin);
            using (var writer = new BinaryWriter(stream, Encoding.ASCII, leaveOpen: true))
            {
                writer.Write(Encoding.ASCII.GetBytes("RIFF"));
                writer.Write((int)(dataLength + 36));
                writer.Write(Encoding.ASCII.GetBytes("WAVE"));
                writer.Write(Encoding.ASCII.GetBytes("fmt "));
                writer.Write(16); // Subchunk1Size for PCM
                writer.Write((short)1); // AudioFormat PCM = 1
                writer.Write(channels);
                writer.Write(sampleRate);
                writer.Write(byteRate);
                writer.Write(blockAlign);
                writer.Write(bitsPerSample);
                writer.Write(Encoding.ASCII.GetBytes("data"));
                writer.Write((int)dataLength);
            }
        }
    }
}
