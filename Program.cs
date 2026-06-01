using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ChallengeService>();
builder.Services.AddSingleton<ScoreService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/challenge", (ChallengeService challenges) =>
{
    var challenge = challenges.GetDailyChallenge(DateOnly.FromDateTime(DateTime.UtcNow));
    return Results.Ok(challenge);
});

app.MapGet("/api/leaderboard", (ScoreService scores) =>
{
    return Results.Ok(scores.GetTopScores());
});

app.MapPost("/api/score", async (SubmitScoreRequest request, ScoreService scores) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { error = "Name is required." });

    var cleanName = request.Name.Trim();
    if (cleanName.Length > 20)
        cleanName = cleanName[..20];

    if (request.Level < 1 || request.Score < 0 || request.Accuracy < 0 || request.Accuracy > 100)
        return Results.BadRequest(new { error = "Invalid score payload." });

    var saved = await scores.SaveAsync(new ScoreEntry(
        cleanName,
        request.Score,
        request.Level,
        Math.Round(request.Accuracy, 1),
        DateTimeOffset.UtcNow));

    return Results.Ok(saved);
});

app.MapFallbackToFile("index.html");

app.Run();

record SubmitScoreRequest(string Name, int Score, int Level, double Accuracy);
record DailyChallenge(string Date, string Seed, int[] Sequence);
record ScoreEntry(string Name, int Score, int Level, double Accuracy, DateTimeOffset PlayedAt);

sealed class ChallengeService
{
    private const int SequenceLength = 48;
    private static readonly char[] Alphabet = ['A', 'I', 'G', 'A', 'M', 'E'];

    public DailyChallenge GetDailyChallenge(DateOnly date)
    {
        var seed = $"signal-sprint:{date:yyyy-MM-dd}";
        var sequence = new int[SequenceLength];
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(seed));

        for (var i = 0; i < sequence.Length; i++)
        {
            var offset = i % bytes.Length;
            sequence[i] = (bytes[offset] + Alphabet[i % Alphabet.Length]) % 9;
        }

        return new DailyChallenge(date.ToString("yyyy-MM-dd"), Convert.ToHexString(bytes)[..12], sequence);
    }
}

sealed class ScoreService
{
    private readonly string _dataPath;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly ConcurrentQueue<ScoreEntry> _fallbackScores = new();

    public ScoreService(IWebHostEnvironment env)
    {
        _dataPath = Path.Combine(env.ContentRootPath, "data", "scores.json");
    }

    public IReadOnlyList<ScoreEntry> GetTopScores()
    {
        var scores = LoadScores();
        return scores
            .OrderByDescending(score => score.Score)
            .ThenByDescending(score => score.Level)
            .ThenByDescending(score => score.Accuracy)
            .ThenBy(score => score.PlayedAt)
            .Take(10)
            .ToList();
    }

    public async Task<IReadOnlyList<ScoreEntry>> SaveAsync(ScoreEntry entry)
    {
        await _lock.WaitAsync();
        try
        {
            var scores = LoadScores().ToList();
            scores.Add(entry);
            scores = scores
                .OrderByDescending(score => score.Score)
                .ThenByDescending(score => score.Level)
                .ThenByDescending(score => score.Accuracy)
                .ThenBy(score => score.PlayedAt)
                .Take(50)
                .ToList();

            Directory.CreateDirectory(Path.GetDirectoryName(_dataPath)!);
            await File.WriteAllTextAsync(_dataPath, JsonSerializer.Serialize(scores, new JsonSerializerOptions { WriteIndented = true }));
            return scores.Take(10).ToList();
        }
        catch
        {
            _fallbackScores.Enqueue(entry);
            return GetTopScores();
        }
        finally
        {
            _lock.Release();
        }
    }

    private IReadOnlyList<ScoreEntry> LoadScores()
    {
        try
        {
            if (!File.Exists(_dataPath))
                return _fallbackScores.ToList();

            var json = File.ReadAllText(_dataPath);
            return JsonSerializer.Deserialize<List<ScoreEntry>>(json) ?? [];
        }
        catch
        {
            return _fallbackScores.ToList();
        }
    }
}

