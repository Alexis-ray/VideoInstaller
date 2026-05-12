using System.Text.Json;
using System.Text.Json.Serialization;

namespace VideoInstaller.Desktop.Utils;

public static class JsonHelpers
{
    public static readonly JsonSerializerOptions DefaultOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static T? Deserialize<T>(string json)
    {
        return JsonSerializer.Deserialize<T>(json, DefaultOptions);
    }

    public static string Serialize<T>(T value)
    {
        return JsonSerializer.Serialize(value, DefaultOptions);
    }
}
