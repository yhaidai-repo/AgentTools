using PowerLoom.SqlIntegration.Features.Connections;
using PowerLoom.SqlIntegration.Features.Connections.Models;

namespace PowerLoom.Api.Tests.ReadSql;

public sealed class SqlConnectionStringsTests
{
    [Theory]
    [InlineData("Server=db1;Database=Pvs", "db1", "Pvs")]
    [InlineData("data source=tcp:db1,1433;initial catalog=Vapi;Integrated Security=true", "tcp:db1,1433", "Vapi")]
    [InlineData("Address=db1", "db1", "")]
    public void The_server_and_database_come_from_any_of_their_key_names(string connectionString, string server, string database)
    {
        Assert.Equal(new SqlConnectionTarget(server, database), SqlConnectionStrings.Parse(connectionString));
    }

    [Theory]
    [InlineData("Database=Pvs")]
    [InlineData("Server= ;Database=Pvs")]
    [InlineData("just words")]
    [InlineData("")]
    public void A_string_without_a_server_is_not_a_connection_string(string connectionString)
    {
        Assert.Null(SqlConnectionStrings.Parse(connectionString));
    }
}
