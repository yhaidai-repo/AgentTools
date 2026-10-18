using PowerLoom.Features.Tasks.CreateTask;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Tasks;

public static class TasksFeature
{
    public static IServiceCollection AddTasksFeature(this IServiceCollection services)
    {
        services.AddScoped<TaskScheduling>();
        services.AddScoped<TaskCreation>();
        services.AddSingleton<ICronSource, TaskScheduleCronSource>();

        return services;
    }
}
