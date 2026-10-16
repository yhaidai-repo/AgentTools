namespace PowerLoom.Features.Status.Models;

// What the outside-access rules read: the open access requests and the recent outside calls, newest first.
public sealed record OutsideAccessData(List<OutsideAccessRequest> Requests, List<OutsideCall> Calls);
