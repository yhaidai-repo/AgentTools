using PowerLoom.Features.Tasks.Producers;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Tasks;

// Every agent that can be scheduled registers its producer here; a new one is one class and one line.
public static class TasksFeature
{
    public static IServiceCollection AddTasksFeature(this IServiceCollection services)
    {
        services.AddScoped<TaskScheduling>();
        services.AddScoped<ITaskProducer, VaultReviewProducer>();
        services.AddSingleton<ICronSource, TaskScheduleCronSource>();

        return services;
    }
}
